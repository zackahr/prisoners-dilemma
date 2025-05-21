from .models import GameMatch, GameRound

def calculate_payoff(player_1_action, player_2_action):

    if player_1_action == "Cooperate" and player_2_action == "Cooperate":
        return 20, 20
    elif player_1_action == "Cooperate" and player_2_action == "Defect":
        return 0, 30
    elif player_1_action == "Defect" and player_2_action == "Cooperate":
        return 30, 0
    elif player_1_action == "Defect" and player_2_action == "Defect":
        return 10, 10

def update_game_stats(match_id):
    """
    Update the game statistics after each round.
    This includes updating cooperation percentages for both players.
    """
    game_match = GameMatch.objects.get(match_id=match_id)
    rounds = game_match.rounds.all()

    total_cooperation_1 = sum(1 for round in rounds if round.player_1_action == "Cooperate")
    total_cooperation_2 = sum(1 for round in rounds if round.player_2_action == "Cooperate")

    player_1_cooperation_percent = (total_cooperation_1 / len(rounds)) * 100 if rounds else 0
    player_2_cooperation_percent = (total_cooperation_2 / len(rounds)) * 100 if rounds else 0

    avg_cooperation_percent = (player_1_cooperation_percent + player_2_cooperation_percent) / 2

    game_match.player_1_cooperation_percent = player_1_cooperation_percent
    game_match.player_2_cooperation_percent = player_2_cooperation_percent
    game_match.avg_cooperation_percent = avg_cooperation_percent
    game_match.save()

