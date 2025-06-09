from .models import UltimatumGameRound
from django.utils import timezone

def calculate_simultaneous_payoff(p1_offer, p2_offer, p1_response, p2_response):
    """
    Calculate payoffs for simultaneous offers:
    - P1 gets p2_offer if they accept P2's offer, otherwise 0
    - P2 gets p1_offer if they accept P1's offer, otherwise 0
    """
    p1_coins = p2_offer if p1_response == "accept" else 0
    p2_coins = p1_offer if p2_response == "accept" else 0
    total_coins = p1_coins + p2_coins
    
    return p1_coins, p2_coins, total_coins

def calculate_match_statistics(match_uuid, current_round_number):
    """Calculate acceptance rates and average offers for the match"""
    completed_rounds = UltimatumGameRound.objects.filter(
        game_match_uuid=match_uuid,
        round_number__lte=current_round_number,
        player_1_offer__isnull=False,
        player_2_offer__isnull=False,
        player_1_response_to_p2_offer__isnull=False,
        player_2_response_to_p1_offer__isnull=False
    ).order_by('round_number')
    
    if not completed_rounds.exists():
        return 0, 0, 0, 0
    
    total_rounds = completed_rounds.count()
    # Count total possible acceptances (2 per round)
    total_possible_accepts = total_rounds * 2
    
    # Count actual acceptances
    total_accepts = 0
    total_offers = 0
    
    for r in completed_rounds:
        if r.player_1_response_to_p2_offer == 'accept':
            total_accepts += 1
        if r.player_2_response_to_p1_offer == 'accept':
            total_accepts += 1
        total_offers += r.player_1_offer + r.player_2_offer
    
    match_acceptance_rate = (total_accepts / total_possible_accepts) * 100 if total_possible_accepts > 0 else 0
    match_average_offer = total_offers / (total_rounds * 2) if total_rounds > 0 else 0
    
    # Current round stats
    current_round = completed_rounds.filter(round_number=current_round_number).first()
    if current_round:
        current_accepts = 0
        if current_round.player_1_response_to_p2_offer == 'accept':
            current_accepts += 1
        if current_round.player_2_response_to_p1_offer == 'accept':
            current_accepts += 1
        
        round_acceptance = (current_accepts / 2) * 100
        round_offer = (current_round.player_1_offer + current_round.player_2_offer) / 2
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
    if not current_round.is_round_complete():
        return
    
    # Calculate round payoff
    p1_coins, p2_coins, total_coins = calculate_simultaneous_payoff(
        current_round.player_1_offer,
        current_round.player_2_offer,
        current_round.player_1_response_to_p2_offer,
        current_round.player_2_response_to_p1_offer
    )
    
    current_round.player_1_coins_made_in_round = p1_coins
    current_round.player_2_coins_made_in_round = p2_coins
    current_round.players_sum_coins_in_round = total_coins
    current_round.round_end = timezone.now().strftime('%Y-%m-%d %H:%M')
    
    # Calculate cumulative scores
    previous_rounds = UltimatumGameRound.objects.filter(
        game_match_uuid=match_uuid,
        round_number__lt=round_number
    )
    
    p1_cumulative = sum(r.player_1_coins_made_in_round for r in previous_rounds) + p1_coins
    p2_cumulative = sum(r.player_2_coins_made_in_round for r in previous_rounds) + p2_coins
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