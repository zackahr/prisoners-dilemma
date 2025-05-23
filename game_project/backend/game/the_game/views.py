from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import uuid
from .models import GameMatch
from .fingerprint import get_fingerprint
from django.shortcuts import get_object_or_404

@csrf_exempt
def create_match(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        game_mode = data.get('game_mode', 'online')
        player_fingerprint = data.get('player_fingerprint')
        
        # Generate a unique match ID
        match_id = str(uuid.uuid4())[:8]
        
        # Get IP and location info
        ip_address = request.META.get('REMOTE_ADDR', '127.0.0.1')
        
        # Create the game match
        game_match = GameMatch.objects.create(
            match_id=match_id,
            game_mode=game_mode,
            player_1_fingerprint=player_fingerprint,
            player_1_ip=ip_address,
            player_1_country='Unknown', 
            player_1_city='Unknown',
        )
        
        return JsonResponse({
            'status': 'success',
            'match_id': match_id,
        })
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=400)

def match_results(request, match_id):
    match = get_object_or_404(GameMatch, match_id=match_id)

    return JsonResponse({
        "status": "success",
        "player_1_score":          match.player_1_final_score,
        "player_2_score":          match.player_2_final_score,
        "player_1_cooperation":    round(match.player_1_cooperation_percent, 1),
        "player_2_cooperation":    round(match.player_2_cooperation_percent, 1),
    })
