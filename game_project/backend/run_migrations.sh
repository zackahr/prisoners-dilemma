#!/bin/bash

set -o allexport
source ../.env
set +o allexport

echo "Running migrations..."
docker-compose exec backend python manage.py makemigrations the_game
docker-compose exec backend python manage.py makemigrations ultimatum

docker-compose exec backend python manage.py migrate
echo "Migrations completed!"
