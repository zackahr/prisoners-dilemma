from django.urls import path
from . import views

urlpatterns = [
    path("create_match/",  views.create_or_join_match, name="ultimatum_create_match"),
    path("offer/",         views.submit_offer,         name="ultimatum_offer"),
    path("response/",      views.submit_response,      name="ultimatum_response"),
    path("<uuid:pk>/",     views.game_state,           name="ultimatum_state"),
]
