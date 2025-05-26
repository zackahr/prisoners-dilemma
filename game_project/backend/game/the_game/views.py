from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import uuid
from .models import GameMatch 


@csrf_exempt
def create_match(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        game_mode = data.get('game_mode', 'online')
        # IMPORTANT: player_fingerprint should be sent from the frontend
        player_fingerprint = data.get('player_fingerprint') 

        if not player_fingerprint:
            return JsonResponse({'status': 'error', 'message': 'Player fingerprint is required'}, status=400)

        ip_address = request.META.get('REMOTE_ADDR', '127.0.0.1')
        
        game_match = None

        if game_mode == 'online':
        
            try:
                game_match = GameMatch.objects.get(
                    game_mode='online',
                    player_2_fingerprint__isnull=True, 
                    is_complete=False
                )
                # ── REFUSE if the same browser tries to occupy both seats ──────────
                if game_match.player_1_fingerprint == player_fingerprint:
                    return JsonResponse(
                        {"status": "error",
                        "message": "You are already registered in this match."},
                        status=400
                    )
                game_match.player_2_fingerprint = player_fingerprint
                game_match.player_2_ip = ip_address
                game_match.player_2_country = 'Unknown' # Placeholder
                game_match.player_2_city = 'Unknown'    # Placeholder
                game_match.save()
                status_message = 'joined_existing_match'
                print(f"Player {player_fingerprint} joined existing match {game_match.match_id}")

            except GameMatch.DoesNotExist:
                match_id = str(uuid.uuid4())[:8] 
                game_match = GameMatch.objects.create(
                    match_id=match_id,
                    game_mode=game_mode,
                    player_1_fingerprint=player_fingerprint,
                    player_1_ip=ip_address,
                    player_1_country='Unknown', 
                    player_1_city='Unknown',
                )
                status_message = 'created_new_match'
                print(f"Player {player_fingerprint} created new match {game_match.match_id}")
            
  
        elif (game_match and 
                  (game_match.player_1_fingerprint == player_fingerprint or 
                   game_match.player_2_fingerprint == player_fingerprint)):
                status_message = 'rejoined_match'
                print(f"Player {player_fingerprint} rejoined match {game_match.match_id}")
            
        elif game_mode == 'bot':
            match_id = str(uuid.uuid4())[:8]
            game_match = GameMatch.objects.create(
                match_id=match_id,
                game_mode=game_mode,
                player_1_fingerprint=player_fingerprint,
                player_1_ip=ip_address,
                player_1_country='Unknown', 
                player_1_city='Unknown',
                player_2_fingerprint='bot' # Immediately set bot as player 2
            )
            status_message = 'created_bot_match'
            print(f"Player {player_fingerprint} created bot match {game_match.match_id}")


        return JsonResponse({
            'status': status_message,
            'match_id': game_match.match_id,
            'game_mode': game_match.game_mode,
            'player_1_fingerprint': game_match.player_1_fingerprint,
            'player_2_fingerprint': game_match.player_2_fingerprint,
        })
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=400)