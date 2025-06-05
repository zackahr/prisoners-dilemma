# ultimatum/routing.py

from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Match exactly 8-character match_id (alphanumeric)
    re_path(r'ws/ultimatum-game/(?P<match_id>\w{8})/$', 
            consumers.UltimatumGameConsumer.as_asgi()),
]
