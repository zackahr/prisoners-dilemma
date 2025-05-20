#!/bin/bash

set -o allexport
source .env
set +o allexport

# Run Django migrations
echo "Running migrations..."

docker-compose exec -it backend python manage.py makemigrations the_game
docker-compose exec -it backend python manage.py migrate
echo "Migrations completed!"