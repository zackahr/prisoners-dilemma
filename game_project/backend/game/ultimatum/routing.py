from django.urls import re_path
from .consumers import UltimatumConsumer

websocket_urlpatterns = [
    re_path(r"ws/ultimatum/(?P<match_id>[0-9a-f\-]+)/$", UltimatumConsumer.as_asgi()),
]
