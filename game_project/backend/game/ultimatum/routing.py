from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path('ws/ultimatum-game/<str:match_id>/', consumers.UltimatumGameConsumer.as_asgi()),
]
