import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import GameMatch, GameRound
from .game_logic import calculate_payoff, update_game_stats
from asgiref.sync import sync_to_async
import asyncio

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
		
		# Send current game state to the newly connected client
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
			
		# Handle different action types
		if action == 'join':
			# Handle player joining the game
			await self.handle_join(player_fingerprint)
			
			# Send join notification to the WebSocket group
			await self.channel_layer.group_send(
				self.room_group_name,
				{
					'type': 'game_action',
					'player_fingerprint': player_fingerprint,
					'action': 'join'
				}
			)
		elif action in ['Cooperate', 'Defect']:
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
				# Calculate round results and update game state
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
				
				# If playing against bot, trigger bot's move for next round
				if self.game_match.game_mode == 'bot':
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
	
	@database_sync_to_async
	def get_game_match(self, match_id):
		try:
			return GameMatch.objects.get(match_id=match_id)
		except GameMatch.DoesNotExist:
			return None
	
	@database_sync_to_async
	def handle_join(self, player_fingerprint):
		# If this is player 2 joining and the slot is empty
		if (self.game_match.player_2_fingerprint is None and 
			player_fingerprint != self.game_match.player_1_fingerprint):
			self.game_match.player_2_fingerprint = player_fingerprint
			self.game_match.player_2_ip = self.scope['client'][0]
			self.game_match.player_2_country = 'Unknown'  # You would use a geolocation service
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
		current_round, created = GameRound.objects.get_or_create(
			match=self.game_match,
			round_number=current_round_number,
			defaults={
				'player_1_action': None,
				'player_2_action': None
			}
		)
		
		# Update the player's action
		if player_fingerprint == self.game_match.player_1_fingerprint:
			current_round.player_1_action = action
		elif player_fingerprint == self.game_match.player_2_fingerprint:
			current_round.player_2_action = action
		
		current_round.save()
	
	@database_sync_to_async
	def check_round_complete(self):
		# Check if both players have made their choices for the current round
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
		
		# Get current round
		current_round_number = self.game_match.rounds.count() + 1
		if current_round_number > 25:  # Assuming 25 is the max number of rounds
			game_over = True
		else:
			game_over = False
			
		# Check if we're waiting for player 2 to join
		waiting_for_player = self.game_match.player_2_fingerprint is None
		
		# Get the latest actions for the current round
		current_round = None
		player_1_last_action = None
		player_2_last_action = None
		
		if not game_over and self.game_match.rounds.filter(round_number=current_round_number-1).exists():
			current_round = self.game_match.rounds.get(round_number=current_round_number-1)
			player_1_last_action = current_round.player_1_action
			player_2_last_action = current_round.player_2_action
		
		return {
			'currentRound': current_round_number if not game_over else 25,
			'maxRounds': 25,  # Assuming 25 is the max number of rounds
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
	
	async def make_bot_move(self):
		# This is a simple bot strategy - you can make it more sophisticated
		from .Bot import make_bot_decision
		
		# Get player's history
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