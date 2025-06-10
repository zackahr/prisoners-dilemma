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

def format_cooperation_percentage(value):
    """
    Format cooperation percentage to show whole numbers without decimals,
    and decimals with up to 2 decimal places (removing trailing zeros).
    
    Examples:
    - 1.0 -> 1
    - 0.5 -> 0.5  
    - 0.333333 -> 0.33
    - 0.666666 -> 0.67
    """
    if value == int(value):
        return int(value)
    else:
        # Round to 2 decimal places and remove trailing zeros
        rounded = round(value, 2)
        if rounded == int(rounded):
            return int(rounded)
        return rounded

def update_game_stats(match_id):
    """
    Update the game statistics after each round.
    This calculates progressive statistics for each round individually.
    """
    try:
        game_match = GameMatch.objects.get(match_id=match_id)
    except GameMatch.DoesNotExist:
        return
    
    rounds = game_match.rounds.all().order_by('round_number')
    
    if not rounds.exists():
        return
    
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
    
    # Calculate progressive statistics for each round
    completed_rounds = rounds.filter(
        player_1_action__isnull=False,
        player_2_action__isnull=False
    ).order_by('round_number')
    
    # Process each completed round and calculate its progressive statistics
    for i, round_obj in enumerate(completed_rounds, 1):
        # Get all rounds up to and including this round
        rounds_up_to_current = completed_rounds[:i]
        
        # Count cooperations up to this round
        player_1_cooperations = sum(1 for r in rounds_up_to_current if r.player_1_action == "Cooperate")
        player_2_cooperations = sum(1 for r in rounds_up_to_current if r.player_2_action == "Cooperate")
        
        # Calculate cooperation percentages as decimals (0-1)
        rounds_count = len(rounds_up_to_current)
        player_1_cooperation_percent = player_1_cooperations / rounds_count if rounds_count > 0 else 0
        player_2_cooperation_percent = player_2_cooperations / rounds_count if rounds_count > 0 else 0
        avg_cooperation_percent = (player_1_cooperation_percent + player_2_cooperation_percent) / 2
        
        # Calculate cumulative scores up to this round
        player_1_cumulative_score = sum(r.player_1_score for r in rounds_up_to_current if r.player_1_score is not None)
        player_2_cumulative_score = sum(r.player_2_score for r in rounds_up_to_current if r.player_2_score is not None)
        
        # Format the cooperation percentages before saving
        round_obj.player_1_cooperation_percent = format_cooperation_percentage(player_1_cooperation_percent)
        round_obj.player_2_cooperation_percent = format_cooperation_percentage(player_2_cooperation_percent)
        round_obj.avg_cooperation_percent = format_cooperation_percentage(avg_cooperation_percent)
        round_obj.player_1_cumulative_score = player_1_cumulative_score
        round_obj.player_2_cumulative_score = player_2_cumulative_score
        round_obj.save()
    
    if completed_rounds.exists():
        final_round = completed_rounds.last()
        game_match.player_1_cooperation_percent = final_round.player_1_cooperation_percent
        game_match.player_2_cooperation_percent = final_round.player_2_cooperation_percent
        game_match.avg_cooperation_percent = final_round.avg_cooperation_percent
    
    # Check for game completion after 25 rounds
    if completed_rounds.count() >= 25:
        game_match.is_complete = True
        game_match.completed_at = timezone.now().strftime('%Y-%m-%d %H:%M')
        
        # Calculate final scores from all rounds
        game_match.player_1_final_score = sum(r.player_1_score for r in completed_rounds if r.player_1_score is not None)
        game_match.player_2_final_score = sum(r.player_2_score for r in completed_rounds if r.player_2_score is not None)
    
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