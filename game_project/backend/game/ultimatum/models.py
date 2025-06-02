from django.db import models
from django.utils import timezone
import uuid

class UltimatumGameRound(models.Model):
    GAME_MODES = [
        ('online', 'Online'),
        ('bot', 'Bot'),
    ]
    
    RESPONSE_CHOICES = [
        ('accept', 'Accept'),
        ('reject', 'Reject'),
    ]
    
    row_number = models.AutoField(primary_key=True)
    game_match_uuid = models.CharField(max_length=8, db_index=True)
    round_number = models.IntegerField()
    game_mode = models.CharField(max_length=10, choices=GAME_MODES, default='online')

    
    player_1_fingerprint = models.CharField(max_length=255)
    player_2_fingerprint = models.CharField(max_length=255, blank=True, null=True)    
    
    # Game actions - coins
    player_1_coins_to_keep = models.IntegerField(null=True, blank=True)
    player_1_coins_to_offer = models.IntegerField(null=True, blank=True)
    player_2_coins_to_keep = models.IntegerField(null=True, blank=True)
    player_2_coins_to_offer = models.IntegerField(null=True, blank=True)
    
    # Game responses
    player_1_response = models.CharField(max_length=10, choices=RESPONSE_CHOICES, null=True, blank=True)
    player_2_response = models.CharField(max_length=10, choices=RESPONSE_CHOICES, null=True, blank=True)
    
    # Round scores
    player_1_coins_made_in_round = models.IntegerField(default=0)
    player_2_coins_made_in_round = models.IntegerField(default=0)
    players_sum_coins_in_round = models.IntegerField(default=0)
    
    # Cumulative scores
    round_player_1_cumulative_score = models.IntegerField(default=0)
    round_player_2_cumulative_score = models.IntegerField(default=0)
    players_sum_coins_total = models.IntegerField(default=0)
    
    # Final scores (only populated in last round)
    player_1_final_score = models.IntegerField(default=0)
    player_2_final_score = models.IntegerField(default=0)
    
    round_player_1_fairness_percent = models.FloatField(default=0)
    round_player_2_fairness_percent = models.FloatField(default=0)
    round_avg_fairness_percent = models.FloatField(default=0)
    match_player_1_fairness_percent = models.FloatField(default=0)
    match_player_2_fairness_percent = models.FloatField(default=0)
    match_avg_fairness_percent = models.FloatField(default=0)
    
    # Player locations
    player_1_ip = models.GenericIPAddressField()
    player_2_ip = models.GenericIPAddressField(blank=True, null=True)
    player_1_country = models.CharField(max_length=100, default='Unknown')
    player_1_city = models.CharField(max_length=100, default='Unknown')
    player_2_country = models.CharField(max_length=100, blank=True, null=True, default='Unknown')
    player_2_city = models.CharField(max_length=100, blank=True, null=True, default='Unknown')
    # Timestamps
    round_start = models.CharField(max_length=50, blank=True, null=True)
    round_end = models.CharField(max_length=50, blank=True, null=True)
    
    # Match status
    match_complete = models.BooleanField(default=False)
    match_completed_at = models.CharField(max_length=50, blank=True, null=True)
    
    class Meta:
        unique_together = ['game_match_uuid', 'round_number']
        ordering = ['game_match_uuid', 'round_number']
    
    def save(self, *args, **kwargs):
        if not self.round_start:
            self.round_start = timezone.now().strftime('%Y-%m-%d %H:%M')
        if self.round_end and not isinstance(self.round_end, str):
            self.round_end = timezone.now().strftime('%Y-%m-%d %H:%M')
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Round {self.round_number} of Match {self.game_match_uuid}"