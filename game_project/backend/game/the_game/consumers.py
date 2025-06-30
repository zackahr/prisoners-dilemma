import json
import asyncio
import logging
from django.utils import timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async
from .models import GameMatch, GameRound
from .game_logic import calculate_payoff, update_game_stats

logger = logging.getLogger(__name__)


class GameConsumer(AsyncWebsocketConsumer):

    # ───────────────────────── connect ──────────────────────────
    async def connect(self):
        self.match_id = self.scope["url_route"]["kwargs"]["match_id"]
        self.game_match = await self.get_game_match(self.match_id)
        if not self.game_match:
            logger.warning("Match %s not found – closing WS", self.match_id)
            await self.close()
            return

        self.room_group_name = f"game_{self.match_id}"
        await self.channel_layer.group_add(self.room_group_name,
                                           self.channel_name)
        await self.accept()

        await self.send(text_data=json.dumps({
            "game_state": await self.get_game_state()
        }))

    # ─────────────────────── disconnect ─────────────────────────
    async def disconnect(self, _code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name,
                                                   self.channel_name)

        # Delete incomplete matches on disconnect
        if self.game_match:
            match_id = self.match_id
            deleted = await self.delete_incomplete_match()
            if deleted:
                await self.channel_layer.group_send(self.room_group_name, {
                    "type": "game_aborted",
                    "msg": "Match was incomplete and has been deleted.",
                    "redirect_to": "/prisoners"
                })
                logger.info("Incomplete match %s deleted.", match_id)

    async def game_aborted(self, event):
        await self.send(text_data=json.dumps({
            "game_aborted": True,
            "message": event["msg"],
            "redirect_to": event.get("redirect_to", "/prisoners")  # Default to prisoners page
        }))

    # ──────────────────────── receive ───────────────────────────
    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get("action")
        fp = data.get("player_fingerprint")
        if not action or not fp:
            return

        gs = await self.get_game_state()
        if gs["gameOver"]:
            await self.send(text_data=json.dumps(
                {"error": "Game is already over"}))
            return

        # ─────── join ───────
        if action == "join":
            if not await self.handle_join(fp):
                await self.send(text_data=json.dumps(
                    {"error": "Match is full or already started."}))
                await self.close()
                return
            await self.channel_layer.group_send(self.room_group_name, {
                "type": "game_state_update",
                "game_state": await self.get_game_state(),
            })
            return

        # ─────── timeout/abandon ───────
        if action == "timeout" or action == "abandon":
            logger.info("Player %s abandoned match %s due to timeout", fp, self.match_id)
            
            # Mark match as complete/abandoned and notify all players
            await self.channel_layer.group_send(self.room_group_name, {
                "type": "game_aborted",
                "msg": "Match ended due to player inactivity. You will be redirected to the game lobby.",
                "redirect_to": "/prisoners"  # Redirect to prisoners page
            })
            
            # Delete the match
            if self.game_match:
                await database_sync_to_async(self.game_match.delete)()
                logger.info("Match %s deleted due to timeout", self.match_id)
            return

        # ─── cooperate / defect ───
        if action in ("Cooperate", "Defect"):
            if fp not in (
                self.game_match.player_1_fingerprint,
                self.game_match.player_2_fingerprint,
                "bot",
            ):
                await self.send(text_data=json.dumps(
                    {"error": "You are not a registered player."}))
                return

            if not await self.process_action(fp, action): 
                return

            await self.channel_layer.group_send(self.room_group_name, {
                "type": "game_action",
                "player_fingerprint": fp,
                "action": action,
            })

            # bot replies right after human move
            if (self.game_match.game_mode == "bot"
                    and fp == self.game_match.player_1_fingerprint):
                await asyncio.sleep(0.4)
                await self.make_bot_move()

            # settle results when both moves are present
            if await self.check_round_complete():
                await self.calculate_round_results()
                gs = await self.get_game_state()
                await self.channel_layer.group_send(self.room_group_name, {
                    "type": "game_state_update",
                    "game_state": gs,
                })
                if gs["gameOver"]:
                    await self.save_final_scores(gs)
                    await self.channel_layer.group_send(self.room_group_name, {
                        "type": "game_over",
                        "player1_score": gs["player1Score"],
                        "player2_score": gs["player2Score"],
                        "player1_cooperation": gs["player1CooperationPercent"],
                        "player2_cooperation": gs["player2CooperationPercent"],
                    })

    # ─────────────── group message helpers ────────────────
    async def game_action(self, event):
        await self.send(text_data=json.dumps({
            "player_fingerprint": event["player_fingerprint"],
            "action": event["action"],
        }))

    async def game_state_update(self, event):
        await self.send(text_data=json.dumps({
            "game_state": event["game_state"]
        }))

    async def game_over(self, event):
        await self.send(text_data=json.dumps({
            "game_over": True,
            "player1_score": event["player1_score"],
            "player2_score": event["player2_score"],
            "player1_cooperation": event["player1_cooperation"],
            "player2_cooperation": event["player2_cooperation"],
        }))

    # ──────────────────────  DB helpers  ──────────────────────
    @database_sync_to_async
    def get_game_match(self, match_id):
        try:
            return GameMatch.objects.get(match_id=match_id)
        except GameMatch.DoesNotExist:
            return None

    @database_sync_to_async
    def delete_incomplete_match(self):
        """Delete the match if it's incomplete"""
        if self.game_match:
            return self.game_match.delete_if_incomplete()
        return False

    @database_sync_to_async
    def handle_join(self, fp):
        if self.game_match.is_complete:
            return False

        if not self.game_match.player_1_fingerprint:
            self.game_match.player_1_fingerprint = fp
            self.game_match.save()
            return True

        if self.game_match.player_1_fingerprint == fp:
            return True

        if self.game_match.game_mode == "online":
            if self.game_match.player_2_fingerprint in (None, fp):
                if fp == self.game_match.player_1_fingerprint:
                    # same fingerprint – reject
                    return False
                self.game_match.player_2_fingerprint = fp
                self.game_match.save()
                return True
        else:  # bot mode
            if self.game_match.player_2_fingerprint != "bot":
                self.game_match.player_2_fingerprint = "bot"
                self.game_match.save()
            return True
        return False

    # ─────────────────────────────────────────────────────────
    @database_sync_to_async
    def process_action(self, fp, action) -> bool:
        """
        Store the first valid click.
        Returns True if stored, False otherwise.
        """
        latest = self.game_match.rounds.order_by("-round_number").first()
        rnd_no = 1
        if latest and latest.player_1_action and latest.player_2_action:
            rnd_no = latest.round_number + 1
        elif latest:
            rnd_no = latest.round_number

        if rnd_no > 25:
            return False

        rnd, _ = GameRound.objects.get_or_create(
            match=self.game_match,
            round_number=rnd_no,
            defaults={"round_start_time": timezone.now().strftime('%Y-%m-%d %H:%M')},
        )

        wrote = False
        # either player may act first – we just store their own choice
        if fp == self.game_match.player_1_fingerprint:
            if rnd.player_1_action is None:
                rnd.player_1_action = action
                wrote = True
        elif fp == self.game_match.player_2_fingerprint:
            if rnd.player_2_action is None:
                rnd.player_2_action = action
                wrote = True

        rnd.save()
        return wrote

    @database_sync_to_async
    def check_round_complete(self):
        r = self.game_match.rounds.order_by("-round_number").first()
        return bool(r and r.player_1_action and r.player_2_action)

    @database_sync_to_async
    def calculate_round_results(self):
        r = self.game_match.rounds.order_by("-round_number").first()
        p1, p2 = calculate_payoff(r.player_1_action, r.player_2_action)
        r.player_1_score, r.player_2_score = p1, p2
        r.round_end_time = timezone.now().strftime('%Y-%m-%d %H:%M')
        r.save()
        update_game_stats(self.game_match.match_id)
        # 👇 NEW – open empty record for the coming round
        if r.round_number < 25:
            GameRound.objects.get_or_create(
                match=self.game_match,
                round_number=r.round_number + 1,
            )

    # ─────────────── assemble state for the client ───────────────
    @database_sync_to_async
    def get_game_state(self):
        self.game_match.refresh_from_db()
        rounds = self.game_match.rounds.order_by("round_number")

        p1 = p2 = 0
        history = []
        for r in rounds:
            if r.player_1_action and r.player_2_action:
                p1 += r.player_1_score
                p2 += r.player_2_score
                history.append({
                    "roundNumber": r.round_number,
                    "player1Action": r.player_1_action,
                    "player2Action": r.player_2_action,
                    "player1Points": r.player_1_score,
                    "player2Points": r.player_2_score,
                })

        next_rnd = len(history) + 1
        if rounds and (rounds.last().player_1_action is None or
                       rounds.last().player_2_action is None):
            next_rnd = rounds.last().round_number

        game_over = self.game_match.is_complete or next_rnd > 25
        waiting = self.game_match.player_2_fingerprint is None \
                    and self.game_match.game_mode == "online"

        last = rounds.last()
        return {
            "currentRound": min(next_rnd, 25),
            "maxRounds": 25,
            "player1Score": p1,
            "player2Score": p2,
            "player1CooperationPercent": self.game_match.player_1_cooperation_percent,
            "player2CooperationPercent": self.game_match.player_2_cooperation_percent,
            "roundHistory": history,
            "waitingForOpponent": waiting,
            "gameOver": game_over,
            "player1LastAction": last.player_1_action if last else None,
            "player2LastAction": last.player_2_action if last else None,
            "gameMode": self.game_match.game_mode,
            "player1Fingerprint": self.game_match.player_1_fingerprint,
            "player2Fingerprint": self.game_match.player_2_fingerprint,
        }

    @database_sync_to_async
    def save_final_scores(self, gs):
        self.game_match.player_1_final_score = gs["player1Score"]
        self.game_match.player_2_final_score = gs["player2Score"]
        self.game_match.is_complete = True
        self.game_match.completed_at = timezone.now().strftime('%Y-%m-%d %H:%M')
        self.game_match.save()

    # ────────────────────── bot helper ──────────────────────────
    async def make_bot_move(self):
        from .Bot import make_bot_decision

        rounds = await database_sync_to_async(
            lambda: list(self.game_match.rounds.order_by("round_number"))
        )()
        player_hist = [r.player_1_action for r in rounds if r.player_1_action]
        bot_hist = [r.player_2_action for r in rounds if r.player_2_action]

        bot_action = await sync_to_async(make_bot_decision)(
            player_hist, bot_hist
        )
        await self.process_action("bot", bot_action)
        await self.channel_layer.group_send(self.room_group_name, {
            "type": "game_action",
            "player_fingerprint": "bot",
            "action": bot_action,
        })