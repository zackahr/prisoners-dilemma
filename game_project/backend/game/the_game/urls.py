from django.urls import path
from the_game import views
from django.views.generic import TemplateView

urlpatterns = [
    path('create_match/', views.create_match, name='create_match'),
]