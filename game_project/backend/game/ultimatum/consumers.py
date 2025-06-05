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
        
        # Check if match exists before connecting
        self.match_exists = await self.check_match_exists(self.match_id)
        
        if not self.match_exists:
            logger.warning("Match %s not found – closing WS", self.match_id)
            print(f"Match {self.match_id} not found – closing WS")
            await self.close(code=4004)  # Use specific close code
            return

        self.room_group_name = f"ultimatum_game_{self.match_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Send initial game state
        try:
            game_state = await self.get_game_state()
            await self.send(text_data=json.dumps({
                "game_state": game_state
            }))
            logger.info(f"Sent initial game state for match {self.match_id}")
        except Exception as e:
            logger.error(f"Error sending initial game state: {e}")
            await self.send(text_data=json.dumps({
                "error": "Failed to load game state"
            }))

    async def disconnect(self, code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        # Only delete matches with no completed rounds to avoid deleting active games
        if hasattr(self, 'match_exists') and self.match_exists:
            completed_count = await self.get_completed_rounds_count()
            if completed_count == 0:  # Only delete if no rounds completed
                deleted = await self.delete_incomplete_match()
                if deleted:
                    logger.info("Empty match %s deleted on disconnect.", self.match_id)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({"error": "Invalid JSON"}))
            return
            
        action = data.get("action")
        fp = data.get("player_fingerprint")
        
        if not action or not fp:
            await self.send(text_data=json.dumps({"error": "Missing action or player_fingerprint"}))
            return

        logger.info(f"Received action {action} from player {fp} in match {self.match_id}")

        try:
            gs = await self.get_game_state()
            if gs.get("error"):
                await self.send(text_data=json.dumps({"error": gs["error"]}))
                return
                
            if gs.get("gameOver"):
                await self.send(text_data=json.dumps({"error": "Game is already over"}))
                return
        except Exception as e:
            logger.error(f"Error getting game state: {e}")
            await self.send(text_data=json.dumps({"error": "Failed to get game state"}))
            return

        # Handle join
        if action == "join":
            join_result = await self.handle_join(fp)
            if not join_result:
                await self.send(text_data=json.dumps({"error": "Cannot join match"}))
                return
            
            # Broadcast updated game state to all players
            updated_game_state = await self.get_game_state()
            await self.channel_layer.group_send(self.room_group_name, {
                "type": "game_state_update",
                "game_state": updated_game_state,
            })
            return

        # Handle game actions
        if action == "make_offer":
            offer = data.get("offer")
            if offer is None or not (0 <= offer <= 100):
                await self.send(text_data=json.dumps({"error": "Invalid offer amount"}))
                return

            if not await self.process_offer(fp, offer):
                await self.send(text_data=json.dumps({"error": "Cannot make offer"}))
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
                await self.send(text_data=json.dumps({"error": "Cannot respond to offer"}))
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
                
                if gs.get("gameOver"):
                    await self.channel_layer.group_send(self.room_group_name, {
                        "type": "game_over",
                        "player1_score": gs.get("player1Score", 0),
                        "player2_score": gs.get("player2Score", 0),
                    })
                else:
                    # Create next round
                    await self.create_next_round()

        # Handle bot actions
        try:
            current_round = await self.get_current_round()
            if current_round and current_round.game_mode == "bot":
                if action == "make_offer" and current_round.current_responder_fingerprint == "bot":
                    await asyncio.sleep(1.0)  # Bot thinking time
                    await self.make_bot_response()
                elif action == "respond_to_offer" and current_round.current_proposer_fingerprint == "bot":
                    await asyncio.sleep(1.0)  # Bot thinking time
                    await self.make_bot_offer()
        except Exception as e:
            logger.error(f"Error handling bot actions: {e}")

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
    def get_completed_rounds_count(self):
        return UltimatumGameRound.objects.filter(
            game_match_uuid=self.match_id,
            proposer_offer__isnull=False,
            responder_response__isnull=False
        ).count()

    @database_sync_to_async
    def delete_incomplete_match(self):
        return UltimatumGameRound.delete_incomplete_match(self.match_id)

    @database_sync_to_async
    def handle_join(self, fp):
        try:
            first_round = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id, 
                round_number=1
            ).first()
            
            if not first_round or first_round.match_complete:
                logger.warning(f"Match {self.match_id} not found or complete")
                return False

            # If player 1 doesn't exist, set it
            if not first_round.player_1_fingerprint:
                first_round.player_1_fingerprint = fp
                first_round.save()
                logger.info(f"Set player 1 for match {self.match_id}: {fp}")
                return True

            # If this is player 1, allow reconnection
            if first_round.player_1_fingerprint == fp:
                logger.info(f"Player 1 reconnected to match {self.match_id}: {fp}")
                return True

            # Handle player 2 joining
            if first_round.game_mode == "online":
                if not first_round.player_2_fingerprint:
                    # Don't allow same player to be both player 1 and 2
                    if fp == first_round.player_1_fingerprint:
                        logger.warning(f"Same player trying to join as both players: {fp}")
                        return False
                    first_round.player_2_fingerprint = fp
                    first_round.save()
                    logger.info(f"Set player 2 for match {self.match_id}: {fp}")
                    return True
                elif first_round.player_2_fingerprint == fp:
                    # Allow player 2 to reconnect
                    logger.info(f"Player 2 reconnected to match {self.match_id}: {fp}")
                    return True
                else:
                    # Match is full with different players
                    logger.warning(f"Match {self.match_id} full. P1: {first_round.player_1_fingerprint}, P2: {first_round.player_2_fingerprint}, trying: {fp}")
                    return False
            else:  # bot mode
                if first_round.player_2_fingerprint != "bot":
                    first_round.player_2_fingerprint = "bot"
                    first_round.save()
                    logger.info(f"Set bot as player 2 for match {self.match_id}")
                return True
            
            return False
        except Exception as e:
            logger.error(f"Error in handle_join: {e}")
            return False

    @database_sync_to_async
    def get_current_round(self):
        try:
            rounds = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id
            ).order_by('-round_number')
            return rounds.first()
        except Exception as e:
            logger.error(f"Error getting current round: {e}")
            return None

    @database_sync_to_async
    def process_offer(self, fp, offer):
        try:
            current_round = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id
            ).order_by('-round_number').first()
            
            if not current_round or current_round.proposer_offer is not None:
                logger.warning(f"Cannot process offer for {self.match_id}: round not found or offer already made")
                return False

            # Check if this player is the proposer for this round
            if fp != current_round.current_proposer_fingerprint:
                logger.warning(f"Player {fp} is not the proposer for round {current_round.round_number} in match {self.match_id}")
                return False

            current_round.proposer_offer = offer
            current_round.save()
            logger.info(f"Offer {offer} processed for player {fp} in match {self.match_id}")
            return True
        except Exception as e:
            logger.error(f"Error processing offer: {e}")
            return False

    @database_sync_to_async
    def process_response(self, fp, response):
        try:
            current_round = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id
            ).order_by('-round_number').first()
            
            if not current_round or current_round.responder_response is not None:
                logger.warning(f"Cannot process response for {self.match_id}: round not found or response already made")
                return False

            # Check if this player is the responder for this round
            if fp != current_round.current_responder_fingerprint:
                logger.warning(f"Player {fp} is not the responder for round {current_round.round_number} in match {self.match_id}")
                return False

            # Check if offer has been made
            if current_round.proposer_offer is None:
                logger.warning(f"No offer made yet for round {current_round.round_number} in match {self.match_id}")
                return False

            current_round.responder_response = response
            current_round.save()
            logger.info(f"Response {response} processed for player {fp} in match {self.match_id}")
            return True
        except Exception as e:
            logger.error(f"Error processing response: {e}")
            return False

    @database_sync_to_async
    def check_round_complete(self):
        try:
            current_round = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id
            ).order_by('-round_number').first()
            
            if not current_round:
                return False
                
            is_complete = (current_round.proposer_offer is not None and 
                          current_round.responder_response is not None)
            
            if is_complete:
                logger.info(f"Round {current_round.round_number} complete in match {self.match_id}")
            
            return is_complete
        except Exception as e:
            logger.error(f"Error checking round complete: {e}")
            return False

    @database_sync_to_async
    def calculate_round_results(self):
        try:
            current_round = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id
            ).order_by('-round_number').first()
            
            if current_round:
                update_game_stats(self.match_id, current_round.round_number)
                logger.info(f"Round results calculated for round {current_round.round_number} in match {self.match_id}")
        except Exception as e:
            logger.error(f"Error calculating round results: {e}")

    @database_sync_to_async
    def create_next_round(self):
        try:
            current_round = UltimatumGameRound.objects.filter(
                game_match_uuid=self.match_id
            ).order_by('-round_number').first()
            
            if current_round and current_round.round_number < 25:
                first_round = UltimatumGameRound.objects.get(
                    game_match_uuid=self.match_id, 
                    round_number=1
                )
                
                next_round = UltimatumGameRound.objects.create(
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
                logger.info(f"Created round {next_round.round_number} for match {self.match_id}")
        except Exception as e:
            logger.error(f"Error creating next round: {e}")

    @database_sync_to_async
    def get_game_state(self):
        try:
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
        except Exception as e:
            logger.error(f"Error getting game state: {e}")
            return {"error": f"Failed to get game state: {str(e)}"}

    # Bot helpers
    async def make_bot_offer(self):
        try:
            offer = random.randint(20, 50)
            if await self.process_offer("bot", offer):
                await self.channel_layer.group_send(self.room_group_name, {
                    "type": "game_action",
                    "player_fingerprint": "bot",
                    "action": "make_offer",
                    "offer": offer,
                })
                logger.info(f"Bot made offer {offer} in match {self.match_id}")
        except Exception as e:
            logger.error(f"Error making bot offer: {e}")

    async def make_bot_response(self):
        try:
            current_round = await self.get_current_round()
            if current_round and current_round.proposer_offer is not None:
                # Simple bot strategy: accept if offer >= 30, otherwise reject
                response = "accept" if current_round.proposer_offer >= 30 else "reject"
                
                if await self.process_response("bot", response):
                    await self.channel_layer.group_send(self.room_group_name, {
                        "type": "game_action",
                        "player_fingerprint": "bot",
                        "action": "respond_to_offer",
                        "response": response,
                    })
                    logger.info(f"Bot responded {response} to offer {current_round.proposer_offer} in match {self.match_id}")
        except Exception as e:
            logger.error(f"Error making bot response: {e}")