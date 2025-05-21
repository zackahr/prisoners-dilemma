import json
from channels.generic.websocket import AsyncWebsocketConsumer
from .models import GameMatch, GameRound
from .game_logic import calculate_payoff, update_game_stats
from asgiref.sync import async_to_sync

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.match_id = self.scope['url_route']['kwargs']['match_id']
        self.game_match = GameMatch.objects.get(match_id=self.match_id)
        
        self.room_group_name = f"game_{self.match_id}"

        # Join the room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')
        player_fingerprint = data.get('player_fingerprint')

        # Process action and update the round stats
        if action:
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

    async def game_action(self, event):
        player_fingerprint = event['player_fingerprint']
        action = event['action']

        # Send action to WebSocket
        await self.send(text_data=json.dumps({
            'player_fingerprint': player_fingerprint,
            'action': action
        }))
        
    async def process_action(self, player_fingerprint, action):
        if player_fingerprint == self.game_match.player_1_fingerprint:
            player_1_action = action
            player_2_action = self.game_match.rounds.last().player_2_action if self.game_match.rounds.exists() else None
        else:
            player_1_action = self.game_match.rounds.last().player_1_action if self.game_match.rounds.exists() else None
            player_2_action = action

        game_round = GameRound.objects.create(
            match=self.game_match,
            round_number=self.game_match.rounds.count() + 1,
            player_1_action=player_1_action,
            player_2_action=player_2_action,
        )

        player_1_payoff, player_2_payoff = calculate_payoff(player_1_action, player_2_action)
        game_round.save()

        update_game_stats(self.match_id)
