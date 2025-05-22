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
        return 0, 0  # Default case if actions are invalid

def update_game_stats(match_id):
    """
    Update the game statistics after each round.
    This includes updating cooperation percentages for both players.
    """
    game_match = GameMatch.objects.get(match_id=match_id)
    rounds = game_match.rounds.all()
    
    if not rounds.exists():
        return
    
    # Update the current round with scores
    current_round = rounds.last()
    if current_round.player_1_action and current_round.player_2_action:
        player_1_payoff, player_2_payoff = calculate_payoff(
            current_round.player_1_action, 
            current_round.player_2_action
        )
        current_round.player_1_score = player_1_payoff
        current_round.player_2_score = player_2_payoff
        current_round.round_end_time = timezone.now()
        current_round.save()
    
    # Update cooperation percentages
    total_cooperation_1 = sum(1 for round in rounds if round.player_1_action == "Cooperate")
    total_cooperation_2 = sum(1 for round in rounds if round.player_2_action == "Cooperate")
    
    player_1_cooperation_percent = (total_cooperation_1 / len(rounds)) * 100 if rounds else 0
    player_2_cooperation_percent = (total_cooperation_2 / len(rounds)) * 100 if rounds else 0
    avg_cooperation_percent = (player_1_cooperation_percent + player_2_cooperation_percent) / 2
    
    game_match.player_1_cooperation_percent = player_1_cooperation_percent
    game_match.player_2_cooperation_percent = player_2_cooperation_percent
    game_match.avg_cooperation_percent = avg_cooperation_percent
    
    if len(rounds) >= 25 and all(r.player_1_action and r.player_2_action for r in rounds):
        game_match.is_complete = True
        game_match.completed_at = timezone.now()
        
        player_1_total_score = sum(calculate_payoff(r.player_1_action, r.player_2_action)[0] for r in rounds)
        player_2_total_score = sum(calculate_payoff(r.player_1_action, r.player_2_action)[1] for r in rounds)
        
        game_match.player_1_final_score = player_1_total_score
        game_match.player_2_final_score = player_2_total_score
    
    game_match.save()