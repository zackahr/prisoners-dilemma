import uuid
from django.db import models

class Match(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mode        = models.CharField(max_length=8, choices=[("online", "Online"), ("bot", "Bot")])
    proposer_id = models.CharField(max_length=64)
    responder_id= models.CharField(max_length=64, blank=True, null=True)
    is_complete = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)

class Offer(models.Model):
    match   = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="offers")
    amount  = models.PositiveIntegerField()
    accepted= models.BooleanField(null=True)
    sent_by = models.CharField(max_length=64)
    sent_at = models.DateTimeField(auto_now_add=True)
