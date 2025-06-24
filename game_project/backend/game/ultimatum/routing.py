from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Match what Nginx is actually sending (without /ws/ prefix)
    re_path(r'^ultimatum-game/(?P<match_id>[-\w]+)/$', consumers.UltimatumGameConsumer.as_asgi()),
]

