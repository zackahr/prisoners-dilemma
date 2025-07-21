#!/bin/bash
set -a
source ../.env  # Correct path to .env file
set +a

docker compose exec -T db psql -U postgres -d "$DB_NAME" < "../$SQL_FILE_PRISONERS" > data_prisoner.csv

echo "SQL query executed, output saved to data_prisoner.csv"
