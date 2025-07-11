from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Match what Nginx is actually sending (with /ws/ prefix)
    re_path(r'^ws/ultimatum-game/(?P<match_id>[-\w]+)/$', consumers.UltimatumGameConsumer.as_asgi()),
]

