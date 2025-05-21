import random

class Bot:
    @staticmethod
    def get_action(round_number):
        """ A simple AI that cooperates 50% of the time and defects 50% of the time """
        return random.choice([COOPERATE, DEFECT])
