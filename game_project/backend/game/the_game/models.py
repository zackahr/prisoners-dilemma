from django.db import models
from django.utils import timezone

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
    # Added fields for final scores
    player_1_final_score = models.IntegerField(default=0)
    player_2_final_score = models.IntegerField(default=0)
    is_complete = models.BooleanField(default=False)
    completed_at = models.CharField(max_length=50, blank=True, null=True)

    def get_completed_rounds_count(self):
        """Get the number of completed rounds for this match"""
        return self.rounds.filter(
            player_1_action__isnull=False,
            player_2_action__isnull=False
        ).count()

    def delete_if_incomplete(self):
        """Delete the match if it has fewer than 25 completed rounds"""
        if not self.is_complete and self.get_completed_rounds_count() < 25:
            self.delete()
            return True
        return False

    def save(self, *args, **kwargs):
        if self.completed_at and isinstance(self.completed_at, str):
            pass
        elif self.completed_at:
            self.completed_at = timezone.now().strftime('%Y-%m-%d %H:%M')
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Match {self.match_id} - Player 1: {self.player_1_fingerprint} vs Player 2: {self.player_2_fingerprint or 'Bot'}"

class GameRound(models.Model):
    match = models.ForeignKey(GameMatch, related_name='rounds', on_delete=models.CASCADE)
    round_number = models.IntegerField()
    player_1_action = models.CharField(max_length=10, blank=True, null=True)
    player_2_action = models.CharField(max_length=10, blank=True, null=True)
    round_start_time = models.CharField(max_length=50, blank=True, null=True)  
    round_end_time = models.CharField(max_length=50, blank=True, null=True)  
    player_1_score = models.IntegerField(null=True, blank=True)
    player_2_score = models.IntegerField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.round_start_time:
            self.round_start_time = timezone.now().strftime('%Y-%m-%d %H:%M')        
        if self.round_end_time and not isinstance(self.round_end_time, str):
            self.round_end_time = timezone.now().strftime('%Y-%m-%d %H:%M')
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Round {self.round_number} of Match {self.match.match_id}"