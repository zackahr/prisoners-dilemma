import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import GameMatch, GameRound
from .game_logic import calculate_payoff, update_game_stats
from asgiref.sync import sync_to_async
import asyncio
import logging

logger = logging.getLogger(__name__)

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.match_id = self.scope['url_route']['kwargs']['match_id']
        self.game_match = await self.get_game_match(self.match_id)
        
        if not self.game_match:
            # Match not found, close connection
            await self.close()
            return
        
        self.room_group_name = f"game_{self.match_id}"

        # Join the room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        game_state = await self.get_game_state()
        await self.send(text_data=json.dumps({
            'game_state': game_state
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
        
    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')
        player_fingerprint = data.get('player_fingerprint')

        if not action or not player_fingerprint:
            return
            
        if action == 'join':
            await self.handle_join(player_fingerprint)
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_action',
                    'player_fingerprint': player_fingerprint,
                    'action': 'join'
                }
            )
        elif action in ['Cooperate', 'Defect']:
            # Check if the game is already over
            game_state = await self.get_game_state()
            if game_state['gameOver']:
                await self.send(text_data=json.dumps({
                    'error': 'Game is already over'
                }))
                return
                
            # Process game action
            await self.process_action(player_fingerprint, action)
            
            # Send action to the WebSocket group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_action',
                    'player_fingerprint': player_fingerprint,
                    'action': action
                }
            )
            
            # Check if both players have made their choices
            round_complete = await self.check_round_complete()
            if round_complete:
                await self.calculate_round_results()
                
                # Check if the game is over (reached 25 rounds)
                game_state = await self.get_game_state()
                
                # Send updated game state to all clients
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
                    
                    # Send game over notification
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
                # If playing against bot and game is not over, trigger bot's move for next round
                elif self.game_match.game_mode == 'bot':
                    await asyncio.sleep(1)  # Small delay before bot makes a move
                    await self.make_bot_move()

    async def game_action(self, event):
        player_fingerprint = event['player_fingerprint']
        action = event['action']

        # Send action to WebSocket
        await self.send(text_data=json.dumps({
            'player_fingerprint': player_fingerprint,
            'action': action
        }))
    
    async def game_state_update(self, event):
        game_state = event['game_state']
        
        # Send game state update to WebSocket
        await self.send(text_data=json.dumps({
            'game_state': game_state
        }))
    
    async def game_over(self, event):
        # Send game over notification
        await self.send(text_data=json.dumps({
            'game_over': True,
            'player1_score': event['player1_score'],
            'player2_score': event['player2_score'],
            'player1_cooperation': event['player1_cooperation'],
            'player2_cooperation': event['player2_cooperation']
        }))
    
    @database_sync_to_async
    def get_game_match(self, match_id):
        try:
            return GameMatch.objects.get(match_id=match_id)
        except GameMatch.DoesNotExist:
            return None
    
    @database_sync_to_async
    def handle_join(self, player_fingerprint):
        if (self.game_match.player_2_fingerprint is None and 
            player_fingerprint != self.game_match.player_1_fingerprint):
            self.game_match.player_2_fingerprint = player_fingerprint
            self.game_match.player_2_ip = self.scope['client'][0]
            self.game_match.player_2_country = 'Unknown'  # i have to  use a geolocation service
            self.game_match.player_2_city = 'Unknown'
            self.game_match.save()
            
            # If playing against bot, initialize the bot
            if self.game_match.game_mode == 'bot':
                self.game_match.player_2_fingerprint = 'bot'
                self.game_match.save()
    
    @database_sync_to_async
    def process_action(self, player_fingerprint, action):
        # Get the current round or create a new one
        current_round_number = self.game_match.rounds.count() + 1
        
        if current_round_number > 25:
            return
            
        current_round, created = GameRound.objects.get_or_create(
            match=self.game_match,
            round_number=current_round_number,
            defaults={
                'player_1_action': None,
                'player_2_action': None
            }
        )
        
        if player_fingerprint == self.game_match.player_1_fingerprint and not current_round.player_1_action:
            current_round.player_1_action = action
        elif player_fingerprint == self.game_match.player_2_fingerprint and not current_round.player_2_action:
            current_round.player_2_action = action
        
        current_round.save()
    
    @database_sync_to_async
    def check_round_complete(self):
        current_round_number = self.game_match.rounds.count()
        if current_round_number == 0:
            return False
            
        current_round = self.game_match.rounds.get(round_number=current_round_number)
        return (current_round.player_1_action is not None and 
                current_round.player_2_action is not None)
    
    @database_sync_to_async
    def calculate_round_results(self):
        # Get the current round
        current_round_number = self.game_match.rounds.count()
        current_round = self.game_match.rounds.get(round_number=current_round_number)
        
        # Calculate payoffs
        player_1_payoff, player_2_payoff = calculate_payoff(
            current_round.player_1_action, 
            current_round.player_2_action
        )
        
        # Update game statistics
        update_game_stats(self.game_match.match_id)
    
    @database_sync_to_async
    def get_game_state(self):
        # Get all rounds for this match
        rounds = self.game_match.rounds.all().order_by('round_number')
        
        # Calculate total scores
        player_1_score = 0
        player_2_score = 0
        round_history = []
        
        for game_round in rounds:
            if game_round.player_1_action and game_round.player_2_action:
                p1_payoff, p2_payoff = calculate_payoff(
                    game_round.player_1_action, 
                    game_round.player_2_action
                )
                player_1_score += p1_payoff
                player_2_score += p2_payoff
                
                round_history.append({
                    'roundNumber': game_round.round_number,
                    'player1Action': game_round.player_1_action,
                    'player2Action': game_round.player_2_action,
                    'player1Points': p1_payoff,
                    'player2Points': p2_payoff
                })
        
        current_round_number = self.game_match.rounds.count() + 1
        
        game_over = current_round_number > 25
            
        # Check if we're waiting for player 2 to join
        waiting_for_player = self.game_match.player_2_fingerprint is None
        
        # Get the latest actions for the current round
        player_1_last_action = None
        player_2_last_action = None
        
        if rounds.exists():
            latest_round = rounds.last()
            player_1_last_action = latest_round.player_1_action
            player_2_last_action = latest_round.player_2_action
        
        return {
            'currentRound': current_round_number if not game_over else 25,
            'maxRounds': 25,
            'player1Score': player_1_score,
            'player2Score': player_2_score,
            'player1CooperationPercent': self.game_match.player_1_cooperation_percent,
            'player2CooperationPercent': self.game_match.player_2_cooperation_percent,
            'roundHistory': round_history,
            'waitingForOpponent': waiting_for_player,
            'gameOver': game_over,
            'player1LastAction': player_1_last_action,
            'player2LastAction': player_2_last_action,
            'gameMode': self.game_match.game_mode
        }
    
    @database_sync_to_async
    def save_final_scores(self, game_state):
        """Save the final scores to the GameMatch model"""
        self.game_match.player_1_final_score = game_state['player1Score']
        self.game_match.player_2_final_score = game_state['player2Score']
        self.game_match.save()
    
    async def make_bot_move(self):
        from .Bot import make_bot_decision        
        rounds = await database_sync_to_async(lambda: list(self.game_match.rounds.all().order_by('round_number')))()
        player_history = [r.player_1_action for r in rounds if r.player_1_action]
        bot_history = [r.player_2_action for r in rounds if r.player_2_action]
        # Make bot decision
        bot_action = await sync_to_async(make_bot_decision)(player_history, bot_history)
        
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
        
        # Check if round is complete and update game state
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
            
            # If game is over, save final scores
            if game_state['gameOver']:
                await self.save_final_scores(game_state)
                
                # Send game over notification
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