import json
from datetime import datetime
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async
from .models import Match, Offer
from .bot     import make_bot_decision       # same file you showed

TOTAL_COINS = 100

class UltimatumConsumer(AsyncJsonWebsocketConsumer):
    """
    Actions coming from the browser:
        {action:"join",   player_fingerprint:"abc"}
        {action:"offer",  player_fingerprint:"abc", amount:40}
        {action:"response", player_fingerprint:"xyz", accepted:true}
    """

    # ───────────────────────── connect ──────────────────────────
    async def connect(self):
        self.match_id = self.scope["url_route"]["kwargs"]["match_id"]
        self.group    = f"ult_{self.match_id}"

        self.match = await self._get_match()
        if not self.match:
            await self.close()
            return

        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

        # send initial state
        await self.send_json({"kind": "state", "payload": await self._state()})

    # ─────────────────────── disconnect ─────────────────────────
    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group, self.channel_name)

    # ──────────────────────── receive ───────────────────────────
    async def receive_json(self, content, **_):
        action = content.get("action")
        fp     = content.get("player_fingerprint")
        if not action or not fp:
            return

        if action == "join":
            ok = await self._handle_join(fp)
            if not ok:
                await self.send_json({"kind": "error", "msg": "Match full"})
                await self.close()
                return
            await self._broadcast_state()
            return

        if action == "offer":
            amount = int(content.get("amount", -1))
            if amount < 0 or amount > TOTAL_COINS:
                return
            await self._store_offer(fp, amount)
            await self.channel_layer.group_send(
                self.group,
                {"type": "relay", "payload": {"kind": "offer", "from": fp, "amount": amount}}
            )

            # BOT immediately decides
            if self.match.mode == "bot" and fp == self.match.proposer_id:
                accepted = await sync_to_async(lambda a: a >= TOTAL_COINS * 0.3)(amount)
                await self._store_response("bot", accepted)
                await self.channel_layer.group_send(
                    self.group,
                    {"type": "relay", "payload": {"kind": "response", "from": "bot", "accepted": accepted}}
                )
                await self._finish_if_ready()
            return

        if action == "response":
            accepted = bool(content.get("accepted"))
            await self._store_response(fp, accepted)
            await self.channel_layer.group_send(
                self.group,
                {"type": "relay", "payload": {"kind": "response", "from": fp, "accepted": accepted}}
            )
            await self._finish_if_ready()
            return

    # ─────────────── broadcast helper ────────────────
    async def relay(self, event):
        await self.send_json(event["payload"])

    async def _broadcast_state(self):
        await self.channel_layer.group_send(
            self.group,
            {"type": "relay", "payload": {"kind": "state", "payload": await self._state()}}
        )

    # ──────────────────── DB ops  ────────────────────
    @database_sync_to_async
    def _get_match(self):
        try:
            return Match.objects.get(id=self.match_id)
        except Match.DoesNotExist:
            return None

    @database_sync_to_async
    def _handle_join(self, fp):
        if self.match.responder_id in (None, "", fp):
            if fp == self.match.proposer_id:
                return False
            self.match.responder_id = fp
            self.match.save()
            return True
        return False

    @database_sync_to_async
    def _store_offer(self, fp, amount):
        Offer.objects.update_or_create(
            match=self.match,
            sent_by=fp,
            defaults={"amount": amount, "accepted": None},
        )

    @database_sync_to_async
    def _store_response(self, fp, accepted):
        Offer.objects.filter(match=self.match).exclude(accepted__isnull=False).update(
            accepted=accepted
        )
        self.match.is_complete = True
        self.match.save()

    @database_sync_to_async
    def _state(self):
        # single-source state builder (frontend can poll or react to WS)
        offer = Offer.objects.filter(match=self.match).first()
        state = {
            "proposerId":   self.match.proposer_id,
            "responderId":  self.match.responder_id,
            "totalAmount":  TOTAL_COINS,
            "offer":        offer.amount if offer else None,
            "accepted":     offer.accepted if offer else None,
            "complete":     self.match.is_complete,
        }
        return state

    async def _finish_if_ready(self):
        st = await self._state()
        if st["complete"]:
            # send final earnings
            if st["accepted"]:
                proposer_gain  = TOTAL_COINS - st["offer"]
                responder_gain = st["offer"]
            else:
                proposer_gain = responder_gain = 0
            await self.channel_layer.group_send(
                self.group,
                {
                    "type": "relay",
                    "payload": {
                        "kind": "game_over",
                        "proposerGain": proposer_gain,
                        "responderGain": responder_gain,
                    },
                },
            )
