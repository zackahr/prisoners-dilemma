#!/bin/bash

set -o allexport
source ../.env
set +o allexport

# Run Django migrations
echo "Running migrations..."

# Run makemigrations and migrate commands in a single bash shell session
docker-compose exec backend bash -c "python manage.py makemigrations the_game && python manage.py migrate the_game"

echo "Migrations completed!"
