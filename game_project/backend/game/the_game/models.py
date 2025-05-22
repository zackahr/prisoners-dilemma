from django.db import models

class GameMatch(models.Model):
    GAME_MODES = [
        ('online', 'Online'),
        ('bot', 'Bot'),
    ]
    
    match_id = models.CharField(max_length=255, unique=True)
    game_mode = models.CharField(max_length=10, choices=GAME_MODES, default='online')
    player_1_fingerprint = models.CharField(max_length=255)
    player_2_fingerprint = models.CharField(max_length=255, blank=True, null=True)
    player_1_ip = models.GenericIPAddressField()
    player_2_ip = models.GenericIPAddressField(blank=True, null=True)
    player_1_country = models.CharField(max_length=100)
    player_1_city = models.CharField(max_length=100)
    player_2_country = models.CharField(max_length=100, blank=True, null=True)
    player_2_city = models.CharField(max_length=100, blank=True, null=True)
    
    avg_cooperation_percent = models.FloatField(default=0)
    player_1_cooperation_percent = models.FloatField(default=0)
    player_2_cooperation_percent = models.FloatField(default=0)

    def __str__(self):
        return f"Match {self.match_id} - Player 1: {self.player_1_fingerprint} vs Player 2: {self.player_2_fingerprint or 'Bot'}"


class GameRound(models.Model):
    match = models.ForeignKey(GameMatch, related_name='rounds', on_delete=models.CASCADE)
    round_number = models.IntegerField()
    player_1_action = models.CharField(max_length=10, blank=True, null=True)
    player_2_action = models.CharField(max_length=10, blank=True, null=True)

    round_start_time = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Round {self.round_number} of Match {self.match.match_id}"
