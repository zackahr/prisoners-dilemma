import json
import asyncio
import logging
from django.utils import timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async
from .models import UltimatumGameRound
from .game_logic import update_game_stats
import random

logger = logging.getLogger(__name__)

class UltimatumGameConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.match_id = self.scope["url_route"]["kwargs"]["match_id"]
        self.match_exists = await self.check_match_exists(self.match_id)
        
        if not self.match_exists:
            logger.warning("Match %s not found – closing WS", self.match_id)
            await self.close()
            return

        self.room_group_name = f"ultimatum_game_{self.match_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        await self.send(text_data=json.dumps({
            "game_state": await self.get_game_state()
        }))

    async def disconnect(self, code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        # Delete incomplete matches on disconnect
        if self.match_exists:
            deleted = await self.delete_incomplete_match()
            if deleted:
                await self.channel_layer.group_send(self.room_group_name, {
                    "type": "game_aborted",
                    "msg": "Match was incomplete and has been deleted."
                })
                logger.info("Incomplete match %s deleted.", self.match_id)

    async def game_aborted(self, event):
        await self.send(text_data=json.dumps({
            "game_aborted": True,
            "message": event["msg"],
        }))

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get("action")
        fp = data.get("player_fingerprint")
        
        if not action or not fp:
            return

        gs = await self.get_game_state()
        if gs["gameOver"]:
            await self.send(text_data=json.dumps({"error": "Game is already over"}))
            return

        # Handle join
        if action == "join":
            if not await self.handle_join(fp):
                await self.send(text_data=json.dumps({"error": "Match is full or already started."}))
                await self.close()
                return
            await self.channel_layer.group_send(self.room_group_name, {
                "type": "game_state_update",
                "game_state": await self.get_game_state(),
            })
            return

        # Handle game actions
        if action == "make_offer":
            offer = data.get("offer")
            if offer is None or not (0 <= offer <= 100):
                await self.send(text_data=json.dumps({"error": "Invalid offer amount"}))
                return

            if not await self.process_offer(fp, offer):
                await self.send(text_data=json.dumps({"error": "You are not the proposer or offer already made"}))
                return

            await self.channel_layer.group_send(self.room_group_name, {
                "type": "game_action",
                "player_fingerprint": fp,
                "action": "make_offer",
                "offer": offer,
            })

        elif action == "respond_to_offer":
            response = data.get("response")
            if response not in ["accept", "reject"]:
                await self.send(text_data=json.dumps({"error": "Invalid response"}))
                return

            if not await self.process_response(fp, response):
                await self.send(text_data=json.dumps({"error": "You are not the responder or response already made"}))
                return

            await self.channel_layer.group_send(self.room_group_name, {
                "type": "game_action",
                "player_fingerprint": fp,
                "action": "respond_to_offer",
                "response": response,
            })

            # Check if round is complete after response
            if await self.check_round_complete():
                await self.calculate_round_results()
                gs = await self.get_game_state()
                await self.channel_layer.group_send(self.room_group_name, {
                    "type": "game_state_update",
                    "game_state": gs,
                })
                
                if gs["gameOver"]:
                    await self.channel_layer.group_send(self.room_group_name, {
                        "type": "game_over",
                        "player1_score": gs["player1Score"],
                        "player2_score": gs["player2Score"],
                    })
                else:
                    # Create next round
                    await self.create_next_round()

        # Handle bot actions
        current_round = await self.get_current_round()
        if current_round and current_round.game_mode == "bot":
            if action == "make_offer" and current_round.current_responder_fingerprint == "bot":
                await asyncio.sleep(0.5)
                await self.make_bot_response()
            elif action == "respond_to_offer" and current_round.current_proposer_fingerprint == "bot":
                await asyncio.sleep(0.5)
                await self.make_bot_offer()

    # Group message handlers
    async def game_action(self, event):
        await self.send(text_data=json.dumps({
            "player_fingerprint": event["player_fingerprint"],
            "action": event["action"],
            "offer": event.get("offer"),
            "response": event.get("response"),
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
        }))

    # Database helpers
    @database_sync_to_async
    def check_match_exists(self, match_id):
        return UltimatumGameRound.objects.filter(game_match_uuid=match_id).exists()

    @database_sync_to_async
    def delete_incomplete_match(self):
        return UltimatumGameRound.delete_incomplete_match(self.match_id)

    @database_sync_to_async
    def handle_join(self, fp):
        first_round = UltimatumGameRound.objects.filter(
            game_match_uuid=self.match_id, 
            round_number=1
        ).first()
        
        if not first_round or first_round.match_complete:
            return False

        if not first_round.player_1_fingerprint:
            first_round.player_1_fingerprint = fp
            first_round.save()
            return True

        if first_round.player_1_fingerprint == fp:
            return True

        if first_round.game_mode == "online":
            if first_round.player_2_fingerprint in (None, fp):
                if fp == first_round.player_1_fingerprint:
                    return False
                first_round.player_2_fingerprint = fp
                first_round.save()
                return True
        else:  # bot mode
            if first_round.player_2_fingerprint != "bot":
                first_round.player_2_fingerprint = "bot"
                first_round.save()
            return True
        return False

    @database_sync_to_async
    def get_current_round(self):
        rounds = UltimatumGameRound.objects.filter(game_match_uuid=self.match_id).order_by('-round_number')
        return rounds.first()

    @database_sync_to_async
    def process_offer(self, fp, offer):
        current_round = UltimatumGameRound.objects.filter(
            game_match_uuid=self.match_id
        ).order_by('-round_number').first()
        
        if not current_round or current_round.proposer_offer is not None:
            return False

        # Check if this player is the proposer for this round
        if fp != current_round.current_proposer_fingerprint:
            return False

        current_round.proposer_offer = offer
        current_round.save()
        return True

    @database_sync_to_async
    def process_response(self, fp, response):
        current_round = UltimatumGameRound.objects.filter(
            game_match_uuid=self.match_id
        ).order_by('-round_number').first()
        
        if not current_round or current_round.responder_response is not None:
            return False

        # Check if this player is the responder for this round
        if fp != current_round.current_responder_fingerprint:
            return False

        # Check if offer has been made
        if current_round.proposer_offer is None:
            return False

        current_round.responder_response = response
        current_round.save()
        return True

    @database_sync_to_async
    def check_round_complete(self):
        current_round = UltimatumGameRound.objects.filter(
            game_match_uuid=self.match_id
        ).order_by('-round_number').first()
        
        if not current_round:
            return False
            
        return (current_round.proposer_offer is not None and 
                current_round.responder_response is not None)

    @database_sync_to_async
    def calculate_round_results(self):
        current_round = UltimatumGameRound.objects.filter(
            game_match_uuid=self.match_id
        ).order_by('-round_number').first()
        
        if current_round:
            update_game_stats(self.match_id, current_round.round_number)

    @database_sync_to_async
    def create_next_round(self):
        current_round = UltimatumGameRound.objects.filter(
            game_match_uuid=self.match_id
        ).order_by('-round_number').first()
        
        if current_round and current_round.round_number < 25:
            first_round = UltimatumGameRound.objects.get(game_match_uuid=self.match_id, round_number=1)
            
            UltimatumGameRound.objects.create(
                game_match_uuid=self.match_id,
                round_number=current_round.round_number + 1,
                game_mode=first_round.game_mode,
                player_1_fingerprint=first_round.player_1_fingerprint,
                player_2_fingerprint=first_round.player_2_fingerprint,
                player_1_country=first_round.player_1_country,
                player_1_city=first_round.player_1_city,
                player_2_country=first_round.player_2_country,
                player_2_city=first_round.player_2_city,
            )

    @database_sync_to_async
    def get_game_state(self):
        rounds = list(UltimatumGameRound.objects.filter(
            game_match_uuid=self.match_id
        ).order_by('round_number'))
        
        if not rounds:
            return {"error": "No rounds found"}
        
        first_round = rounds[0]
        current_round = rounds[-1]
        
        # Calculate totals from completed rounds
        completed_rounds = [r for r in rounds if (
            r.proposer_offer is not None and r.responder_response is not None
        )]
        
        total_p1_score = sum(r.player_1_coins_made_in_round for r in completed_rounds)
        total_p2_score = sum(r.player_2_coins_made_in_round for r in completed_rounds)
        
        # Build history
        history = []
        for r in completed_rounds:
            history.append({
                "roundNumber": r.round_number,
                "proposerFingerprint": r.current_proposer_fingerprint,
                "responderFingerprint": r.current_responder_fingerprint,
                "offer": r.proposer_offer,
                "response": r.responder_response,
                "proposerEarned": (100 - r.proposer_offer) if r.responder_response == "accept" else 0,
                "responderEarned": r.proposer_offer if r.responder_response == "accept" else 0,
                "player1Earned": r.player_1_coins_made_in_round,
                "player2Earned": r.player_2_coins_made_in_round,
            })
        
        next_round = len(completed_rounds) + 1
        game_over = current_round.match_complete or next_round > 25
        waiting_for_opponent = (first_round.player_2_fingerprint is None and 
                              first_round.game_mode == "online")
        
        return {
            "currentRound": min(next_round, 25),
            "maxRounds": 25,
            "player1Score": total_p1_score,
            "player2Score": total_p2_score,
            "roundHistory": history,
            "waitingForOpponent": waiting_for_opponent,
            "gameOver": game_over,
            "gameMode": first_round.game_mode,
            "player1Fingerprint": first_round.player_1_fingerprint,
            "player2Fingerprint": first_round.player_2_fingerprint,
            "currentRoundState": {
                "roundNumber": current_round.round_number,
                "proposerFingerprint": current_round.current_proposer_fingerprint,
                "responderFingerprint": current_round.current_responder_fingerprint,
                "offerMade": current_round.proposer_offer is not None,
                "responseMade": current_round.responder_response is not None,
                "offer": current_round.proposer_offer,
                "response": current_round.responder_response,
            }
        }

    # Bot helpers
    async def make_bot_offer(self):
        offer = random.randint(20, 50)
        await self.process_offer("bot", offer)
        await self.channel_layer.group_send(self.room_group_name, {
            "type": "game_action",
            "player_fingerprint": "bot",
            "action": "make_offer",
            "offer": offer,
        })

    async def make_bot_response(self):
        # Simple bot strategy: accept if offer >= 30, otherwise reject
        current_round = await self.get_current_round()
        if current_round and current_round.proposer_offer is not None:
            response = "accept" if current_round.proposer_offer >= 30 else "reject"
            
            await self.process_response("bot", response)
            await self.channel_layer.group_send(self.room_group_name, {
                "type": "game_action",
                "player_fingerprint": "bot",
                "action": "respond_to_offer",
                "response": response,
            })