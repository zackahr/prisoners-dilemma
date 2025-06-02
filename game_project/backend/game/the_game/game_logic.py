from .models import GameMatch, GameRound
from django.utils import timezone

def calculate_payoff(player_1_action, player_2_action):
    """
    Calculate the payoff for a given round based on the actions of both players.
    
    Returns:
        tuple: (player_1_payoff, player_2_payoff)
    """
    if player_1_action == "Cooperate" and player_2_action == "Cooperate":
        return 20, 20
    elif player_1_action == "Cooperate" and player_2_action == "Defect":
        return 0, 30
    elif player_1_action == "Defect" and player_2_action == "Cooperate":
        return 30, 0
    elif player_1_action == "Defect" and player_2_action == "Defect":
        return 10, 10
    else:
        return 0, 0  

def update_game_stats(match_id):
    """
    Update the game statistics after each round.
    This includes updating cooperation percentages for both players.
    If the game doesn't reach 25 rounds and is incomplete, it will be deleted.
    """
    try:
        game_match = GameMatch.objects.get(match_id=match_id)
    except GameMatch.DoesNotExist:
        return
    
    rounds = game_match.rounds.all().order_by('round_number')
    
    if not rounds.exists():
        return
    
    # Update the current round with scores (if not already done)
    current_round = rounds.last()
    if current_round.player_1_action and current_round.player_2_action and \
       (current_round.player_1_score is None or current_round.player_2_score is None):
        player_1_payoff, player_2_payoff = calculate_payoff(
            current_round.player_1_action, 
            current_round.player_2_action
        )
        current_round.player_1_score = player_1_payoff
        current_round.player_2_score = player_2_payoff
        current_round.round_end_time = timezone.now().strftime('%Y-%m-%d %H:%M')
        current_round.save()
    
    # Update cooperation percentages
    total_cooperation_1 = sum(1 for round in rounds if round.player_1_action == "Cooperate")
    total_cooperation_2 = sum(1 for round in rounds if round.player_2_action == "Cooperate")
    
    # Only calculate based on completed rounds for accurate percentage
    completed_rounds_count = sum(1 for round in rounds if round.player_1_action and round.player_2_action)

    player_1_cooperation_percent = (total_cooperation_1 / completed_rounds_count) * 100 if completed_rounds_count else 0
    player_2_cooperation_percent = (total_cooperation_2 / completed_rounds_count) * 100 if completed_rounds_count else 0
    avg_cooperation_percent = (player_1_cooperation_percent + player_2_cooperation_percent) / 2
    
    game_match.player_1_cooperation_percent = player_1_cooperation_percent
    game_match.player_2_cooperation_percent = player_2_cooperation_percent
    game_match.avg_cooperation_percent = avg_cooperation_percent
    
    # Check for game completion after 25 rounds
    if completed_rounds_count >= 25:
        game_match.is_complete = True
        game_match.completed_at = timezone.now().strftime('%Y-%m-%d %H:%M')
        
        # Recalculate total scores from all rounds
        player_1_total_score = sum(r.player_1_score for r in rounds if r.player_1_score is not None)
        player_2_total_score = sum(r.player_2_score for r in rounds if r.player_2_score is not None)
        
        game_match.player_1_final_score = player_1_total_score
        game_match.player_2_final_score = player_2_total_score
        game_match.save()
    else:
        game_match.save()

def cleanup_incomplete_matches():
    """
    Utility function to clean up all incomplete matches.
    This can be called periodically or manually to remove incomplete games.
    """
    incomplete_matches = GameMatch.objects.filter(is_complete=False)
    deleted_count = 0
    
    for match in incomplete_matches:
        if match.delete_if_incomplete():
            deleted_count += 1
    
    return deleted_count