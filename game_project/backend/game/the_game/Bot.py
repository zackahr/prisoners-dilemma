import random

def make_bot_decision(player_history, bot_history):
    """
     the bot copies the player's previous move, but starts with cooperation.
    """
    if not player_history:
        return "Cooperate"
    
    return player_history[-1]

  