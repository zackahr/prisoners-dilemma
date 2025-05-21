# views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Game
from .utils import generate_fingerprint

class CreateGameView(APIView):
    def post(self, request, *args, **kwargs):
        fingerprint = generate_fingerprint(request.headers)
        # Logic to create a game and add players
        game = Game.objects.create(
            match_id="game123",
            player_1_fingerprint=fingerprint,
            player_1_ip=request.META['REMOTE_ADDR'],
            game_mode="ONLINE"
        )
        return Response({"match_id": game.match_id}, status=status.HTTP_201_CREATED)
