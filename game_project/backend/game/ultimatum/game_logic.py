from .models import UltimatumGameRound
from django.utils import timezone

def calculate_ultimatum_payoff(offer, response):

    if response == "accept":
        proposer_coins = 100 - offer  
        responder_coins = offer       
        total_coins = 100
    else:  # reject
        proposer_coins = 0
        responder_coins = 0
        total_coins = 0
    
    return proposer_coins, responder_coins, total_coins

def calculate_match_statistics(match_uuid, current_round_number):
    """Calculate acceptance rates and average offers for the match"""
    completed_rounds = UltimatumGameRound.objects.filter(
        game_match_uuid=match_uuid,
        round_number__lte=current_round_number,
        proposer_offer__isnull=False,
        responder_response__isnull=False
    ).order_by('round_number')
    
    if not completed_rounds.exists():
        return 0, 0, 0, 0
    
    total_rounds = completed_rounds.count()
    accepted_rounds = completed_rounds.filter(responder_response='accept').count()
    match_acceptance_rate = (accepted_rounds / total_rounds) * 100 if total_rounds > 0 else 0
    
    total_offers = sum(r.proposer_offer for r in completed_rounds)
    match_average_offer = total_offers / total_rounds if total_rounds > 0 else 0
    
    # Current round stats
    current_round = completed_rounds.filter(round_number=current_round_number).first()
    if current_round:
        round_acceptance = 100 if current_round.responder_response == 'accept' else 0
        round_offer = current_round.proposer_offer
    else:
        round_acceptance = 0
        round_offer = 0
    
    return round_acceptance, match_acceptance_rate, round_offer, match_average_offer

def update_game_stats(match_uuid, round_number):
    """Update game statistics after each completed round"""
    try:
        current_round = UltimatumGameRound.objects.get(
            game_match_uuid=match_uuid,
            round_number=round_number
        )
    except UltimatumGameRound.DoesNotExist:
        return
    
    # Check if round is complete
    if current_round.proposer_offer is None or current_round.responder_response is None:
        return    
    current_round.proposer_keeps = 100 - current_round.proposer_offer
    
    # Calculate round payoff
    proposer_coins, responder_coins, total_coins = calculate_ultimatum_payoff(
        current_round.proposer_offer,
        current_round.responder_response
    )
    
    # Assign coins to correct players based on roles
    if current_round.player_1_role == 'proposer':
        current_round.player_1_coins_made_in_round = proposer_coins
        current_round.player_2_coins_made_in_round = responder_coins
    else:
        current_round.player_1_coins_made_in_round = responder_coins
        current_round.player_2_coins_made_in_round = proposer_coins
    
    current_round.players_sum_coins_in_round = total_coins
    current_round.round_end = timezone.now().strftime('%Y-%m-%d %H:%M')
    
    # Calculate cumulative scores
    previous_rounds = UltimatumGameRound.objects.filter(
        game_match_uuid=match_uuid,
        round_number__lt=round_number
    )
    
    p1_cumulative = sum(r.player_1_coins_made_in_round for r in previous_rounds) + current_round.player_1_coins_made_in_round
    p2_cumulative = sum(r.player_2_coins_made_in_round for r in previous_rounds) + current_round.player_2_coins_made_in_round
    total_cumulative = p1_cumulative + p2_cumulative
    
    current_round.round_player_1_cumulative_score = p1_cumulative
    current_round.round_player_2_cumulative_score = p2_cumulative
    current_round.players_sum_coins_total = total_cumulative
    
    # Calculate statistics
    (round_acceptance, match_acceptance, 
     round_offer, match_offer) = calculate_match_statistics(match_uuid, round_number)
    
    current_round.round_acceptance_rate = round_acceptance
    current_round.match_acceptance_rate = match_acceptance
    current_round.round_average_offer = round_offer
    current_round.match_average_offer = match_offer
    
    # Check if game is complete
    if round_number >= 25:
        current_round.match_complete = True
        current_round.match_completed_at = timezone.now().strftime('%Y-%m-%d %H:%M')
        current_round.player_1_final_score = p1_cumulative
        current_round.player_2_final_score = p2_cumulative
        
        UltimatumGameRound.objects.filter(game_match_uuid=match_uuid).update(
            match_complete=True,
            match_completed_at=current_round.match_completed_at,
            player_1_final_score=p1_cumulative,
            player_2_final_score=p2_cumulative,
            match_acceptance_rate=match_acceptance,
            match_average_offer=match_offer
        )
    
    current_round.save()

def cleanup_incomplete_matches():
    """Clean up incomplete matches"""
    match_uuids = UltimatumGameRound.objects.values_list('game_match_uuid', flat=True).distinct()
    deleted_count = 0
    
    for match_uuid in match_uuids:
        if UltimatumGameRound.delete_incomplete_match(match_uuid):
            deleted_count += 1
    
    return deleted_count