import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import GameMatch, GameRound
from .game_logic import calculate_payoff, update_game_stats
from asgiref.sync import sync_to_async
import asyncio
import logging
from django.utils import timezone # Import timezone

logger = logging.getLogger(__name__)

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.match_id = self.scope['url_route']['kwargs']['match_id']
        self.game_match = await self.get_game_match(self.match_id)

        if not self.game_match:
            # Match not found, close connection
            logger.warning(f"Match {self.match_id} not found. Closing connection.")
            await self.close()
            return

        self.room_group_name = f"game_{self.match_id}"

        # Join the room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Send initial game state to the connecting client
        game_state = await self.get_game_state()
        await self.send(text_data=json.dumps({
            'game_state': game_state
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            # Remove from room group
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
        
        # Check if the game match exists and is not already complete
        if self.game_match and not self.game_match.is_complete:
            logger.info(f"Player disconnected from match {self.match_id}. Closing game.")
            # Determine which player disconnected
            disconnected_player_fingerprint = None
            if self.scope['user'].is_authenticated: # If you're using user authentication
                # You'd need a way to link the channel name to a player fingerprint
                pass # This example assumes fingerprint is passed on join/action
            
            # For simplicity, if any player disconnects, end the game.
            # In a real app, you might track which fingerprint is associated with this channel.
            
            # Update game match status to complete/aborted
            await self.end_game_on_disconnect()

            # Notify remaining player (if any) about game over
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_over_aborted',
                    'message': 'Opponent disconnected. Game ended.'
                }
            )
        else:
            logger.info(f"Client disconnected from match {self.match_id}. Game already complete or match not found.")


    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')
        player_fingerprint = data.get('player_fingerprint') # Assuming fingerprint is always sent

        if not action or not player_fingerprint:
            logger.warning(f"Invalid action or missing fingerprint received: {data}")
            return

        # Check if the game is already over
        game_state = await self.get_game_state()
        if game_state['gameOver']:
            await self.send(text_data=json.dumps({
                'error': 'Game is already over'
            }))
            return

        if action == 'join':
            join_successful = await self.handle_join(player_fingerprint, self.channel_name)
            if not join_successful:
                await self.send(text_data=json.dumps({
                    'error': 'Match is full or already started.'
                }))
                await self.close() # Close connection if join fails
                return
            
            # Send updated game state to all clients after a player joins
            updated_game_state = await self.get_game_state()
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_state_update',
                    'game_state': updated_game_state
                }
            )
            logger.info(f"Player {player_fingerprint} joined match {self.match_id}")

        elif action in ['Cooperate', 'Defect']:
            # Ensure it's a registered player making a move
            if (player_fingerprint != self.game_match.player_1_fingerprint and
                player_fingerprint != self.game_match.player_2_fingerprint and
                player_fingerprint != 'bot'): # Allow bot moves if applicable
                await self.send(text_data=json.dumps({
                    'error': 'You are not a registered player in this match.'
                }))
                return

            # Process game action
            await self.process_action(player_fingerprint, action)

            # Send action to the WebSocket group (for immediate UI feedback)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_action',
                    'player_fingerprint': player_fingerprint,
                    'action': action
                }
            )

            # Check if both players have made their choices for the current round
            round_complete = await self.check_round_complete()
            if round_complete:
                await self.calculate_round_results()

                # Send updated game state to all clients after round completion
                game_state_after_round = await self.get_game_state()
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'game_state_update',
                        'game_state': game_state_after_round
                    }
                )

                # Check if the game is over (reached 25 rounds or other conditions)
                if game_state_after_round['gameOver']:
                    await self.save_final_scores(game_state_after_round)
                    
                    # Send game over notification
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'game_over',
                            'player1_score': game_state_after_round['player1Score'],
                            'player2_score': game_state_after_round['player2Score'],
                            'player1_cooperation': game_state_after_round['player1CooperationPercent'],
                            'player2_cooperation': game_state_after_round['player2CooperationPercent']
                        }
                    )
                # If playing against bot and game is not over, trigger bot's move for next round
                elif self.game_match.game_mode == 'bot':
                    # Ensure the bot's move is for the *next* round, after current round results are processed
                    # This logic might need slight adjustment based on exact timing requirements.
                    # For now, it will trigger after round completion and state update.
                    await asyncio.sleep(1)  # Small delay for better UX
                    await self.make_bot_move()
            else:
                logger.debug(f"Round {game_state['currentRound']} for match {self.match_id} not yet complete.")

    async def game_action(self, event):
        # This sends individual player actions for immediate feedback (e.g., UI updates "Player 1 made a choice")
        await self.send(text_data=json.dumps({
            'player_fingerprint': event['player_fingerprint'],
            'action': event['action']
        }))

    async def game_state_update(self, event):
        # This sends the full, updated game state
        await self.send(text_data=json.dumps({
            'game_state': event['game_state']
        }))

    async def game_over(self, event):
        await self.send(text_data=json.dumps({
            'game_over': True,
            'player1_score': event['player1_score'],
            'player2_score': event['player2_score'],
            'player1_cooperation': event['player1_cooperation'],
            'player2_cooperation': event['player2_cooperation']
        }))

    async def game_over_aborted(self, event):
        # New event type for aborted games due to disconnect
        await self.send(text_data=json.dumps({
            'game_over': True,
            'aborted': True,
            'message': event['message']
        }))

    @database_sync_to_async
    def get_game_match(self, match_id):
        try:
            return GameMatch.objects.get(match_id=match_id)
        except GameMatch.DoesNotExist:
            return None

    @database_sync_to_async
    def handle_join(self, player_fingerprint, channel_name):
        """
        Handles a player joining a match.
        Ensures only 2 players can join (or 1 player + bot).
        Returns True if join is successful, False otherwise.
        """
        # If the match is already complete, don't allow joins
        if self.game_match.is_complete:
            logger.warning(f"Attempted to join complete match {self.match_id}")
            return False

        # If it's the first player
        if not self.game_match.player_1_fingerprint:
            self.game_match.player_1_fingerprint = player_fingerprint
            self.game_match.player_1_ip = self.scope['client'][0]
            self.game_match.player_1_country = 'Unknown'  # Placeholder
            self.game_match.player_1_city = 'Unknown'    # Placeholder
            self.game_match.save()
            logger.info(f"Player 1 ({player_fingerprint}) set for match {self.match_id}")
            return True
        # If it's player 1 rejoining (e.g., refresh), still allow
        elif self.game_match.player_1_fingerprint == player_fingerprint:
            logger.info(f"Player 1 ({player_fingerprint}) rejoining match {self.match_id}")
            return True
        # If it's the second player attempting to join
        elif (self.game_match.player_2_fingerprint is None or 
              self.game_match.player_2_fingerprint == player_fingerprint): # Allow player 2 to rejoin
            if self.game_match.game_mode == 'online':
                if player_fingerprint == self.game_match.player_1_fingerprint: # Cannot be both players
                    return False
                self.game_match.player_2_fingerprint = player_fingerprint
                self.game_match.player_2_ip = self.scope['client'][0]
                self.game_match.player_2_country = 'Unknown'
                self.game_match.player_2_city = 'Unknown'
                self.game_match.save()
                logger.info(f"Player 2 ({player_fingerprint}) set for match {self.match_id}")
                return True
            elif self.game_match.game_mode == 'bot':
                # For bot mode, player_2_fingerprint will always be 'bot'
                # The human player is player 1. If a second human tries to join a bot game, reject.
                if self.game_match.player_2_fingerprint != 'bot': # If bot not set, set it
                    self.game_match.player_2_fingerprint = 'bot'
                    self.game_match.save()
                    logger.info(f"Bot opponent initialized for match {self.match_id}")
                return True # Allow player 1 to join/rejoin bot game
        
        # If player 2 slot is taken by another human player and it's an online game, reject
        logger.warning(f"Match {self.match_id} is full. Player {player_fingerprint} rejected.")
        return False

    @database_sync_to_async
    def end_game_on_disconnect(self):
        """
        Marks the game as complete and sets final scores to 0 for disconnect.
        """
        if not self.game_match.is_complete:
            self.game_match.is_complete = True
            self.game_match.completed_at = timezone.now()
            self.game_match.player_1_final_score = 0 # Or some other penalty/default
            self.game_match.player_2_final_score = 0 # Or some other penalty/default
            self.game_match.save()
            logger.info(f"Match {self.match_id} ended due to player disconnect.")

    @database_sync_to_async
    def process_action(self, player_fingerprint, action):
        # Get the current round or create a new one
        # If the current round (last round in DB) is complete, create a new one.
        # Otherwise, update the existing current round.
        
        # Get the latest round (if any)
        latest_round = self.game_match.rounds.order_by('-round_number').first()
        
        current_round_number = 1
        if latest_round:
            # If the latest round has both actions, start a new round
            if latest_round.player_1_action and latest_round.player_2_action:
                current_round_number = latest_round.round_number + 1
            else:
                # Otherwise, continue with the current (incomplete) round
                current_round_number = latest_round.round_number

        if current_round_number > 25:
            logger.info(f"Attempted to process action for round {current_round_number} but max rounds is 25.")
            return # Game is already over or should be

        current_round, created = GameRound.objects.get_or_create(
            match=self.game_match,
            round_number=current_round_number,
            defaults={
                'player_1_action': None,
                'player_2_action': None,
                'round_start_time': timezone.now() # Set start time for new round
            }
        )
        
        # Prevent players from changing their action once set for the current round
        if player_fingerprint == self.game_match.player_1_fingerprint:
            if not current_round.player_1_action:
                current_round.player_1_action = action
                logger.info(f"Player 1 ({player_fingerprint}) chose {action} for round {current_round_number}")
            else:
                logger.warning(f"Player 1 ({player_fingerprint}) tried to change action for round {current_round_number}")
        elif player_fingerprint == self.game_match.player_2_fingerprint:
            if not current_round.player_2_action:
                current_round.player_2_action = action
                logger.info(f"Player 2 ({player_fingerprint}) chose {action} for round {current_round_number}")
            else:
                logger.warning(f"Player 2 ({player_fingerprint}) tried to change action for round {current_round_number}")
        
        current_round.save()

    @database_sync_to_async
    def check_round_complete(self):
        current_round = self.game_match.rounds.order_by('-round_number').first()
        if not current_round:
            return False # No rounds started yet
            
        return (current_round.player_1_action is not None and 
                current_round.player_2_action is not None)
    
    @database_sync_to_async
    def calculate_round_results(self):
        # Get the current round (which should be the last one created/updated)
        current_round = self.game_match.rounds.order_by('-round_number').first()
        
        if not current_round or not current_round.player_1_action or not current_round.player_2_action:
            logger.error(f"Attempted to calculate results for an incomplete or non-existent round in match {self.match_id}")
            return # Should not happen if check_round_complete was true
            
        # Calculate payoffs and update round scores
        player_1_payoff, player_2_payoff = calculate_payoff(
            current_round.player_1_action, 
            current_round.player_2_action
        )
        current_round.player_1_score = player_1_payoff
        current_round.player_2_score = player_2_payoff
        current_round.round_end_time = timezone.now()
        current_round.save()
        logger.info(f"Round {current_round.round_number} results calculated for match {self.match_id}: P1={player_1_payoff}, P2={player_2_payoff}")
        
        # Update overall game statistics (cooperation percentages, final scores if game ends)
        update_game_stats(self.game_match.match_id)
    
    @database_sync_to_async
    def get_game_state(self):
        # Reload the game_match to get the latest state from DB
        self.game_match.refresh_from_db()

        rounds = self.game_match.rounds.all().order_by('round_number')
        
        player_1_score = 0
        player_2_score = 0
        round_history = []
        
        # Ensure only completed rounds contribute to scores and history
        for game_round in rounds:
            if game_round.player_1_action and game_round.player_2_action:
                # Use stored scores if available, otherwise recalculate (should be available after calculate_round_results)
                p1_payoff = game_round.player_1_score if game_round.player_1_score is not None else calculate_payoff(game_round.player_1_action, game_round.player_2_action)[0]
                p2_payoff = game_round.player_2_score if game_round.player_2_score is not None else calculate_payoff(game_round.player_1_action, game_round.player_2_action)[1]

                player_1_score += p1_payoff
                player_2_score += p2_payoff
                
                round_history.append({
                    'roundNumber': game_round.round_number,
                    'player1Action': game_round.player_1_action,
                    'player2Action': game_round.player_2_action,
                    'player1Points': p1_payoff,
                    'player2Points': p2_payoff
                })
        
        # Determine the current round number for the *next* action
        current_round_number_for_next_action = len(round_history) + 1 # If all previous rounds are complete

        # Check if the latest round in DB is incomplete. If so, next action is for that round.
        latest_round_in_db = rounds.last()
        if latest_round_in_db and (latest_round_in_db.player_1_action is None or latest_round_in_db.player_2_action is None):
             current_round_number_for_next_action = latest_round_in_db.round_number
        
        game_over = self.game_match.is_complete or (current_round_number_for_next_action > 25)
        
        waiting_for_opponent = (self.game_match.player_2_fingerprint is None and 
                                self.game_match.game_mode == 'online')
        
        player_1_last_action = latest_round_in_db.player_1_action if latest_round_in_db else None
        player_2_last_action = latest_round_in_db.player_2_action if latest_round_in_db else None

        return {
            'currentRound': current_round_number_for_next_action,
            'maxRounds': 25,
            'player1Score': player_1_score,
            'player2Score': player_2_score,
            'player1CooperationPercent': self.game_match.player_1_cooperation_percent,
            'player2CooperationPercent': self.game_match.player_2_cooperation_percent,
            'roundHistory': round_history,
            'waitingForOpponent': waiting_for_opponent,
            'gameOver': game_over,
            'player1LastAction': player_1_last_action,
            'player2LastAction': player_2_last_action,
            'gameMode': self.game_match.game_mode
        }
    
    @database_sync_to_async
    def save_final_scores(self, game_state):
        """Save the final scores to the GameMatch model"""
        # These fields should already be updated by update_game_stats
        # but ensure they are explicitly saved if not already
        self.game_match.player_1_final_score = game_state['player1Score']
        self.game_match.player_2_final_score = game_state['player2Score']
        self.game_match.is_complete = True # Ensure this is marked
        self.game_match.completed_at = timezone.now() # Ensure this is set
        self.game_match.save()
        logger.info(f"Final scores saved for match {self.match_id}: P1={self.game_match.player_1_final_score}, P2={self.game_match.player_2_final_score}")

    async def make_bot_move(self):
        from .Bot import make_bot_decision # Import locally to avoid circular dependencies

        # Fetch history for bot decision
        rounds = await database_sync_to_async(lambda: list(self.game_match.rounds.all().order_by('round_number')))()
        player_history = [r.player_1_action for r in rounds if r.player_1_action and r.player_2_action] # Only completed rounds
        bot_history = [r.player_2_action for r in rounds if r.player_1_action and r.player_2_action] # Only completed rounds

        bot_action = await sync_to_async(make_bot_decision)(player_history, bot_history)
        logger.info(f"Bot decision for match {self.match_id}: {bot_action}")
        
        # Process bot's action
        await self.process_action('bot', bot_action)
        
        # Send bot action to the WebSocket group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_action',
                'player_fingerprint': 'bot',
                'action': bot_action
            }
        )
        
        # After bot makes a move, check if the round is complete and process results
        round_complete = await self.check_round_complete()
        if round_complete:
            await self.calculate_round_results()
            
            # Send updated game state to all clients
            game_state = await self.get_game_state()
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_state_update',
                    'game_state': game_state
                }
            )
            
            # If game is over, save final scores and notify clients
            if game_state['gameOver']:
                await self.save_final_scores(game_state)
                
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'game_over',
                        'player1_score': game_state['player1Score'],
                        'player2_score': game_state['player2Score'],
                        'player1_cooperation': game_state['player1CooperationPercent'],
                        'player2_cooperation': game_state['player2CooperationPercent']
                    }
                )
            # If playing against bot and game is not over, recursively call for next round (if needed, but usually handled by client prompting next round)
            # This part is tricky; usually, the client triggers the next human move, not the bot directly after its own move.
            # If you want the bot to play consecutive rounds without human input, you'd need more complex state management.
            # For now, it assumes the human player will make their move for the next round.