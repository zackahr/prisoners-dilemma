from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render
import json
import uuid
import traceback

from .models import UltimatumGameRound

def get_client_ip(request):
    """Helper function to get the real client IP address"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

@csrf_exempt
def create_match(request):
    """Create or join an Ultimatum Game match"""
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)

    game_mode = data.get('game_mode', 'online')
    player_fingerprint = data.get('player_fingerprint')

    if not player_fingerprint:
        return JsonResponse({'status': 'error', 'message': 'Player fingerprint is required'}, status=400)

    ip_address = get_client_ip(request)
    print(f"[create_match] incoming payload: game_mode={game_mode}, "
          f"player_fingerprint={player_fingerprint}, IP={ip_address}")

    try:
        if game_mode == 'online':
            existing_round = UltimatumGameRound.objects.filter(
                game_mode='online',
                player_2_fingerprint__isnull=True,
                match_complete=False,
                round_number=1
            ).first()

            if existing_round and existing_round.player_1_fingerprint == player_fingerprint:
                return JsonResponse({
                    "status": "error",
                    "message": "You are already registered in this match."
                }, status=400)

            if existing_round:
                # Join the existing match
                existing_round.player_2_fingerprint = player_fingerprint
                existing_round.player_2_country = 'Unknown'
                existing_round.player_2_city = 'Unknown'
                existing_round.player_2_ip_address = ip_address  # Store IP for player 2
                existing_round.save()

                match_id = existing_round.game_match_uuid
                print(f"[create_match] joined existing match {match_id}")
                return JsonResponse({
                    'status': 'joined_existing_match',
                    'match_id': match_id,
                    'game_mode': existing_round.game_mode,
                    'player_1_fingerprint': existing_round.player_1_fingerprint,
                    'player_2_fingerprint': existing_round.player_2_fingerprint,
                })

            else:
                # Create a brand-new match
                match_id = str(uuid.uuid4())[:8]
                new_round = UltimatumGameRound.objects.create(
                    game_match_uuid=match_id,
                    round_number=1,
                    game_mode=game_mode,
                    player_1_fingerprint=player_fingerprint,
                    player_1_country='Unknown',
                    player_1_city='Unknown',
                    player_1_ip_address=ip_address  # Store IP for player 1
                )
                print(f"[create_match] created new match {match_id}")
                return JsonResponse({
                    'status': 'created_new_match',
                    'match_id': match_id,
                    'game_mode': new_round.game_mode,
                    'player_1_fingerprint': new_round.player_1_fingerprint,
                    'player_2_fingerprint': new_round.player_2_fingerprint,
                })

        elif game_mode == 'bot':
            match_id = str(uuid.uuid4())[:8]
            new_round = UltimatumGameRound.objects.create(
                game_match_uuid=match_id,
                round_number=1,
                game_mode=game_mode,
                player_1_fingerprint=player_fingerprint,
                player_1_country='Unknown',
                player_1_city='Unknown',
                player_1_ip_address=ip_address,  # Store IP for player 1
                player_2_fingerprint='bot',
                player_2_country='Bot',
                player_2_city='Bot',
                player_2_ip_address=None  # Bot doesn't have an IP
            )
            print(f"[create_match] created bot match {match_id}")
            return JsonResponse({
                'status': 'created_bot_match',
                'match_id': match_id,
                'game_mode': new_round.game_mode,
                'player_1_fingerprint': new_round.player_1_fingerprint,
                'player_2_fingerprint': new_round.player_2_fingerprint,
            })

        else:
            return JsonResponse({'status': 'error', 'message': 'Invalid game mode'}, status=400)

    except Exception as e:
        print("[create_match] Exception occurred:")
        traceback.print_exc()
        return JsonResponse({'status': 'error', 'message': f'Database error: {str(e)}'}, status=500)

# Rest of your views remain the same...
def game_page(request, match_id):
    """Render the game page for a specific match"""
    try:
        # Check if match exists
        match_exists = UltimatumGameRound.objects.filter(
            game_match_uuid=match_id
        ).exists()
        
        if not match_exists:
            return render(request, 'ultimatum_game/error.html', {
                'error_message': 'Match not found'
            })
        
        # Get match info
        first_round = UltimatumGameRound.objects.filter(
            game_match_uuid=match_id,
            round_number=1
        ).first()
        
        context = {
            'match_id': match_id,
            'game_mode': first_round.game_mode if first_round else 'online',
            'websocket_url': f'ws://localhost:8000/ws/ultimatum-game/{match_id}/',
        }
        
        return render(request, 'ultimatum_game/game.html', context)
        
    except Exception as e:
        return render(request, 'ultimatum_game/error.html', {
            'error_message': f'Error loading game: {str(e)}'
        })

def match_history(request, match_id):
    """Get the history of a specific match"""
    try:
        # Updated to use new field names
        rounds = UltimatumGameRound.objects.filter(
            game_match_uuid=match_id,
            player_1_coins_to_offer__isnull=False,
            player_2_coins_to_offer__isnull=False,
            player_1_response_to_p2_offer__isnull=False,
            player_2_response_to_p1_offer__isnull=False
        ).order_by('round_number')
        
        if not rounds.exists():
            return JsonResponse({
                'status': 'error',
                'message': 'No completed rounds found for this match'
            }, status=404)
        
        history = []
        for round_obj in rounds:
            history.append({
                'round_number': round_obj.round_number,
                'player_1_coins_to_keep': round_obj.player_1_coins_to_keep,
                'player_1_coins_to_offer': round_obj.player_1_coins_to_offer,
                'player_2_coins_to_keep': round_obj.player_2_coins_to_keep,
                'player_2_coins_to_offer': round_obj.player_2_coins_to_offer,
                'player_1_response_to_p2': round_obj.player_1_response_to_p2_offer,
                'player_2_response_to_p1': round_obj.player_2_response_to_p1_offer,
                'player_1_earned': round_obj.player_1_coins_made_in_round,
                'player_2_earned': round_obj.player_2_coins_made_in_round,
                'player_1_cumulative': round_obj.round_player_1_cumulative_score,
                'player_2_cumulative': round_obj.round_player_2_cumulative_score,
                'round_start': round_obj.round_start,
                'round_end': round_obj.round_end,
            })
        
        # Get final match statistics
        last_round = rounds.last()
        
        return JsonResponse({
            'status': 'success',
            'match_id': match_id,
            'game_mode': last_round.game_mode,
            'total_rounds': rounds.count(),
            'match_complete': last_round.match_complete,
            'player_1_final_score': last_round.player_1_final_score,
            'player_2_final_score': last_round.player_2_final_score,
            'match_acceptance_rate': last_round.match_acceptance_rate,
            'match_average_offer': last_round.match_average_offer,
            'history': history
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Error retrieving match history: {str(e)}'
        }, status=500)

def match_stats(request, match_id):
    """Get statistics for a specific match - handles both active and completed matches"""
    try:
        # Get the first round to get basic match info
        first_round = UltimatumGameRound.objects.filter(
            game_match_uuid=match_id,
            round_number=1
        ).first()
        
        if not first_round:
            return JsonResponse({
                'status': 'error',
                'message': 'Match not found'
            }, status=404)
        
        # Count players
        players_count = 1  # Player 1 always exists
        if first_round.player_2_fingerprint:
            players_count = 2
        
        # Check if match is ready (has 2 players or is bot mode)
        is_ready = (
            players_count == 2 or 
            first_round.game_mode == 'bot'
        )
        
        # Get completed rounds using new field names
        completed_rounds = UltimatumGameRound.objects.filter(
            game_match_uuid=match_id,
            player_1_coins_to_offer__isnull=False,
            player_2_coins_to_offer__isnull=False,
            player_1_response_to_p2_offer__isnull=False,
            player_2_response_to_p1_offer__isnull=False
        ).order_by('round_number')
        
        completed_count = completed_rounds.count()
        
        # Basic response for active matches
        response_data = {
            'status': 'success',
            'match_id': match_id,
            'game_mode': first_round.game_mode,
            'players_count': players_count,
            'is_ready': is_ready,
            'waiting_for_player_2': first_round.player_2_fingerprint is None and first_round.game_mode == 'online',
            'match_complete': first_round.match_complete,
            'completed_rounds': completed_count,
            'total_rounds': 25,
            'player_1_fingerprint': first_round.player_1_fingerprint,
            'player_2_fingerprint': first_round.player_2_fingerprint,
        }
        
        if completed_rounds.exists():
            last_round = completed_rounds.last()
            
            total_responses = 0
            total_accepts = 0
            
            for round_obj in completed_rounds:
                if round_obj.player_1_response_to_p2_offer:
                    total_responses += 1
                    if round_obj.player_1_response_to_p2_offer == 'accept':
                        total_accepts += 1
                
                if round_obj.player_2_response_to_p1_offer:
                    total_responses += 1
                    if round_obj.player_2_response_to_p1_offer == 'accept':
                        total_accepts += 1
            
            acceptance_rate = (total_accepts / total_responses * 100) if total_responses > 0 else 0
            
            # Calculate offer statistics using new field names
            all_offers = []
            for round_obj in completed_rounds:
                if round_obj.player_1_coins_to_offer is not None:
                    all_offers.append(round_obj.player_1_coins_to_offer)
                if round_obj.player_2_coins_to_offer is not None:
                    all_offers.append(round_obj.player_2_coins_to_offer)
            
            min_offer = min(all_offers) if all_offers else 0
            max_offer = max(all_offers) if all_offers else 0
            avg_offer = sum(all_offers) / len(all_offers) if all_offers else 0
            
            # Player-specific statistics using new field names
            p1_offers = [r.player_1_coins_to_offer for r in completed_rounds if r.player_1_coins_to_offer is not None]
            p2_offers = [r.player_2_coins_to_offer for r in completed_rounds if r.player_2_coins_to_offer is not None]
            
            p1_average_offer = sum(p1_offers) / len(p1_offers) if p1_offers else 0
            p2_average_offer = sum(p2_offers) / len(p2_offers) if p2_offers else 0
            
            # Player response rates (how often their offers are accepted)
            p1_offers_accepted = sum(1 for r in completed_rounds 
                                   if r.player_1_coins_to_offer is not None and r.player_2_response_to_p1_offer == 'accept')
            p2_offers_accepted = sum(1 for r in completed_rounds 
                                   if r.player_2_coins_to_offer is not None and r.player_1_response_to_p2_offer == 'accept')
            
            p1_acceptance_rate = (p1_offers_accepted / len(p1_offers) * 100) if p1_offers else 0
            p2_acceptance_rate = (p2_offers_accepted / len(p2_offers) * 100) if p2_offers else 0
            
            # Add detailed stats to response
            response_data.update({
                'accepted_responses': total_accepts,
                'rejected_responses': total_responses - total_accepts,
                'overall_acceptance_rate': acceptance_rate,
                'overall_average_offer': avg_offer,
                'min_offer': min_offer,
                'max_offer': max_offer,
                'player_1_final_score': last_round.player_1_final_score,
                'player_2_final_score': last_round.player_2_final_score,
                'player_1_acceptance_rate': p1_acceptance_rate,
                'player_2_acceptance_rate': p2_acceptance_rate,
                'player_1_average_offer': p1_average_offer,
                'player_2_average_offer': p2_average_offer,
                'match_completed_at': last_round.match_completed_at,
            })
        
        return JsonResponse(response_data)
        
    except Exception as e:
        print(f"[match_stats] Error: {str(e)}")
        traceback.print_exc()
        return JsonResponse({
            'status': 'error',
            'message': f'Error retrieving match statistics: {str(e)}'
        }, status=500)

def active_matches(request):
    """Get list of active (incomplete) matches"""
    try:
        active_matches = UltimatumGameRound.objects.filter(
            match_complete=False,
            round_number=1
        ).order_by('-row_number')
        
        matches_data = []
        for match in active_matches:
            completed_rounds = UltimatumGameRound.get_completed_rounds_count(match.game_match_uuid)
            
            matches_data.append({
                'match_id': match.game_match_uuid,
                'game_mode': match.game_mode,
                'player_1_fingerprint': match.player_1_fingerprint,
                'player_2_fingerprint': match.player_2_fingerprint,
                'waiting_for_player_2': match.player_2_fingerprint is None,
                'completed_rounds': completed_rounds,
                'created_at': match.round_start,
            })
        
        return JsonResponse({
            'status': 'success',
            'active_matches': matches_data,
            'total_active': len(matches_data)
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Error retrieving active matches: {str(e)}'
        }, status=500)

def home(request):
    """Home page for the Ultimatum Game"""
    return render(request, 'ultimatum_game/home.html')

def rules(request):
    """Rules page explaining the Ultimatum Game"""
    return render(request, 'ultimatum_game/rules.html')

@csrf_exempt
def cleanup_matches(request):
    """Admin endpoint to cleanup incomplete matches"""
    if request.method == 'POST':
        try:
            from .game_logic import cleanup_incomplete_matches
            deleted_count = cleanup_incomplete_matches()
            
            return JsonResponse({
                'status': 'success',
                'message': f'Cleaned up {deleted_count} incomplete matches'
            })
            
        except Exception as e:
            return JsonResponse({
                'status': 'error',
                'message': f'Error during cleanup: {str(e)}'
            }, status=500)
    
    return JsonResponse({
        'status': 'error',
        'message': 'Invalid request method'
    }, status=405)