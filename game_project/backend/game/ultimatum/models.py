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
    
    # Player information
    player_1_fingerprint = models.CharField(max_length=255)
    player_2_fingerprint = models.CharField(max_length=255, blank=True, null=True)
    player_1_country = models.CharField(max_length=100, default='Unknown')
    player_1_city = models.CharField(max_length=100, default='Unknown')
    player_2_country = models.CharField(max_length=100, blank=True, null=True, default='Unknown')
    player_2_city = models.CharField(max_length=100, blank=True, null=True, default='Unknown')
    
    # Game mode
    game_mode = models.CharField(max_length=10, choices=GAME_MODES, default='online')
    
    # NEW FIELDS: What each player keeps vs offers
    player_1_coins_to_keep = models.IntegerField(null=True, blank=True)
    player_1_coins_to_offer = models.IntegerField(null=True, blank=True)  # This was your old player_1_offer
    player_2_coins_to_keep = models.IntegerField(null=True, blank=True)
    player_2_coins_to_offer = models.IntegerField(null=True, blank=True)  # This was your old player_2_offer
    
    player_1_offer = models.IntegerField(null=True, blank=True)  
    player_2_offer = models.IntegerField(null=True, blank=True) 
    
    player_1_response_to_p2_offer = models.CharField(max_length=10, choices=RESPONSE_CHOICES, null=True, blank=True)
    player_2_response_to_p1_offer = models.CharField(max_length=10, choices=RESPONSE_CHOICES, null=True, blank=True)
    
    player_1_coins_made_in_round = models.IntegerField(default=0)
    player_2_coins_made_in_round = models.IntegerField(default=0)
    players_sum_coins_in_round = models.IntegerField(default=0)
    
    round_player_1_cumulative_score = models.IntegerField(default=0)
    round_player_2_cumulative_score = models.IntegerField(default=0)
    players_sum_coins_total = models.IntegerField(default=0)
    
    player_1_final_score = models.IntegerField(default=0)
    player_2_final_score = models.IntegerField(default=0)
    
    round_acceptance_rate = models.FloatField(default=0)
    match_acceptance_rate = models.FloatField(default=0)
    
    # Average offer amounts
    round_average_offer = models.FloatField(default=0)
    match_average_offer = models.FloatField(default=0)
    
    # Timestamps
    round_start = models.CharField(max_length=50, blank=True, null=True)
    round_end = models.CharField(max_length=50, blank=True, null=True)
    match_completed_at = models.CharField(max_length=50, blank=True, null=True)
    
    # Match status
    match_complete = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ['game_match_uuid', 'round_number']
        ordering = ['game_match_uuid', 'round_number']
    
    def save(self, *args, **kwargs):
        if not self.round_start:
            self.round_start = timezone.now().strftime('%Y-%m-%d %H:%M')
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Round {self.round_number} of Match {self.game_match_uuid}"

    def is_round_complete(self):
        """Check if all actions for this round are complete"""
        return (
            self.player_1_coins_to_keep is not None and 
            self.player_1_coins_to_offer is not None and
            self.player_2_coins_to_keep is not None and
            self.player_2_coins_to_offer is not None and
            self.player_1_response_to_p2_offer is not None and
            self.player_2_response_to_p1_offer is not None
        )

    @classmethod
    def get_match_rounds(cls, match_uuid):
        """Get all rounds for a specific match"""
        return cls.objects.filter(game_match_uuid=match_uuid).order_by('round_number')
    
    @classmethod
    def get_completed_rounds_count(cls, match_uuid):
        """Get count of completed rounds for a match"""
        return cls.objects.filter(
            game_match_uuid=match_uuid,
            player_1_coins_to_keep__isnull=False,
            player_1_coins_to_offer__isnull=False,
            player_2_coins_to_keep__isnull=False,
            player_2_coins_to_offer__isnull=False,
            player_1_response_to_p2_offer__isnull=False,
            player_2_response_to_p1_offer__isnull=False
        ).count()
    
    @classmethod
    def delete_incomplete_match(cls, match_uuid):
        """Delete incomplete match if less than 25 rounds completed"""
        completed_count = cls.get_completed_rounds_count(match_uuid)
        if completed_count < 25:
            cls.objects.filter(game_match_uuid=match_uuid).delete()
            return True
        return False