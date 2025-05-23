import random

def make_bot_decision(player_history, bot_history):
    """
    Make a decision for the bot based on the game history.
    This implements a simple strategy called "Tit for Tat" where the bot
    copies the player's previous move, but starts with cooperation.
    """
    # If this is the first round, cooperate
    if not player_history:
        return "Cooperate"
    
    # Otherwise, do what the player did in the previous round (Tit for Tat)
    return player_history[-1]