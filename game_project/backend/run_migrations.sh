#!/bin/bash

set -o allexport
source ../.env
set +o allexport

# Run Django migrations
echo "Running migrations..."

# Run makemigrations and migrate commands in a single bash shell session
docker-compose exec backend python manage.py makemigrations

docker-compose exec backend python manage.py migrate
echo "Migrations completed!"
