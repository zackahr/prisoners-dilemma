from django.urls import path
from . import views

app_name = 'ultimatum_game'

urlpatterns = [
    path('create-match-ultimatum/', views.create_match, name='create_match-ultimatum'),
    path('game-page/<str:match_id>/', views.game_page, name='game_page'),
    
    # Match data endpoints
    path('match-history/<str:match_id>/', views.match_history, name='match_history'),
    path('match-stats/<str:match_id>/', views.match_stats, name='match_stats'),
    path('active-matches/', views.active_matches, name='active_matches'),
    
    # Admin endpoints
    path('cleanup-matches/', views.cleanup_matches, name='cleanup_matches'),
]