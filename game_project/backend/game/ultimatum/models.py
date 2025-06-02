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
    
    ROLE_CHOICES = [
        ('proposer', 'Proposer'),
        ('responder', 'Responder'),
    ]
    
    # Primary identifiers
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
    
    # Round roles (alternating each round)
    player_1_role = models.CharField(max_length=10, choices=ROLE_CHOICES, blank=True, null=True)
    player_2_role = models.CharField(max_length=10, choices=ROLE_CHOICES, blank=True, null=True)
    
    # Traditional Ultimatum Game actions
    proposer_offer = models.IntegerField(null=True, blank=True)  
    proposer_keeps = models.IntegerField(null=True, blank=True)  
    responder_response = models.CharField(max_length=10, choices=RESPONSE_CHOICES, null=True, blank=True)
    
    # Round results
    player_1_coins_made_in_round = models.IntegerField(default=0)
    player_2_coins_made_in_round = models.IntegerField(default=0)
    players_sum_coins_in_round = models.IntegerField(default=0)
    
    # Cumulative scores
    round_player_1_cumulative_score = models.IntegerField(default=0)
    round_player_2_cumulative_score = models.IntegerField(default=0)
    players_sum_coins_total = models.IntegerField(default=0)
    
    # Final scores (only populated on last round)
    player_1_final_score = models.IntegerField(default=0)
    player_2_final_score = models.IntegerField(default=0)
    
    round_acceptance_rate = models.FloatField(default=0)  # 0 or 100 for this round
    match_acceptance_rate = models.FloatField(default=0)  # Overall acceptance rate for match
    
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
        
        # Set roles for the round (alternating)
        if self.round_number and not self.player_1_role:
            if self.round_number % 2 == 1:  # Odd rounds: P1 proposes, P2 responds
                self.player_1_role = 'proposer'
                self.player_2_role = 'responder'
            else:  # Even rounds: P2 proposes, P1 responds
                self.player_1_role = 'responder'
                self.player_2_role = 'proposer'
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Round {self.round_number} of Match {self.game_match_uuid}"

    @property
    def current_proposer_fingerprint(self):
        """Get the fingerprint of the current round's proposer"""
        if self.player_1_role == 'proposer':
            return self.player_1_fingerprint
        return self.player_2_fingerprint
    
    @property
    def current_responder_fingerprint(self):
        """Get the fingerprint of the current round's responder"""
        if self.player_1_role == 'responder':
            return self.player_1_fingerprint
        return self.player_2_fingerprint

    @classmethod
    def get_match_rounds(cls, match_uuid):
        """Get all rounds for a specific match"""
        return cls.objects.filter(game_match_uuid=match_uuid).order_by('round_number')
    
    @classmethod
    def get_completed_rounds_count(cls, match_uuid):
        """Get count of completed rounds for a match"""
        return cls.objects.filter(
            game_match_uuid=match_uuid,
            proposer_offer__isnull=False,
            responder_response__isnull=False
        ).count()
    
    @classmethod
    def delete_incomplete_match(cls, match_uuid):
        """Delete incomplete match if less than 25 rounds completed"""
        completed_count = cls.get_completed_rounds_count(match_uuid)
        if completed_count < 25:
            cls.objects.filter(game_match_uuid=match_uuid).delete()
            return True
        return False
