import random


def make_bot_decision(player_history, bot_history):
    """
    Probabilistic Tit-for-Tat   (10 % pure random exploration)

        • round 1 → Cooperate
        • otherwise 10 % of the time choose randomly
        • else behave like TFT but only 70 % ‘strict’
    """
    if not player_history:
        return "Cooperate"

    # 10 % exploration
    if random.random() < 0.10:
        return random.choice(["Cooperate", "Defect"])

    last_human = player_history[-1]

    if last_human == "Defect":          # punish 70 % of the time
        return "Defect" if random.random() < 0.70 else "Cooperate"
    else:                               # reward 70 % of the time
        return "Cooperate" if random.random() < 0.70 else "Defect"
