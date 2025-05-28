from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Match, Offer
import uuid
from django.shortcuts import get_object_or_404
@api_view(["POST"])
def create_or_join_match(request):
    pid  = request.data["player_fingerprint"]
    mode = request.data.get("game_mode", "online")

    if mode == "bot":
        match = Match.objects.create(mode="bot", proposer_id=pid, responder_id="bot")
        return Response({"status": "created_bot_match", "match_id": match.id})

    # look for open lobby
    match = Match.objects.filter(mode="online", responder_id__isnull=True).exclude(proposer_id=pid).first()
    if match:
        match.responder_id = pid
        match.save()
        return Response({"status": "joined_existing_match", "match_id": match.id})

    match = Match.objects.create(mode="online", proposer_id=pid)
    return Response({"status": "created_new_match", "match_id": match.id})


# …create_or_join_match already here …

@api_view(["POST"])
def submit_offer(request):
    """
    Body: { match_id, player_id, offer }
    """
    match = get_object_or_404(Match, id=request.data["match_id"])
    Offer.objects.update_or_create(
        match=match,
        sent_by=request.data["player_id"],
        defaults={"amount": int(request.data["offer"]), "accepted": None},
    )
    return Response({"status": "ok"})


@api_view(["POST"])
def submit_response(request):
    """
    Body: { match_id, player_id, accepted }
    """
    match = get_object_or_404(Match, id=request.data["match_id"])
    # mark the (single) offer as accepted / rejected
    Offer.objects.filter(match=match).update(accepted=bool(request.data["accepted"]))
    match.is_complete = True
    match.save()
    return Response({"status": "ok"})


@api_view(["GET"])
def game_state(request, pk):
    """
    GET /api/ultimatum/<uuid:pk>/
    """
    match = get_object_or_404(Match, id=pk)
    offer = Offer.objects.filter(match=match).first()
    return Response({
        "proposerId":  match.proposer_id,
        "responderId": match.responder_id,
        "totalAmount": 100,
        "offer":       offer.amount   if offer else None,
        "accepted":    offer.accepted if offer else None,
        "complete":    match.is_complete,
    })
