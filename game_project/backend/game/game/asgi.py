import os
from channels.auth     import AuthMiddlewareStack
from channels.routing  import ProtocolTypeRouter, URLRouter
from django.core.asgi  import get_asgi_application

from the_game.routing     import websocket_urlpatterns as pd_ws
from ultimatum.routing    import websocket_urlpatterns as ult_ws

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "game.settings")

application = ProtocolTypeRouter(
    {
        "http":      get_asgi_application(),
        "websocket": AuthMiddlewareStack(URLRouter(pd_ws + ult_ws)),
    }
)
