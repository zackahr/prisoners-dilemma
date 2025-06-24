#!/bin/bash

set -a
source ../.env
set +a

docker compose exec -T db psql -U postgres -d "$DB_NAME" < "../$SQL_FILE_ULTIMATUM" > ultimatum_output_data.csv

echo "SQL query executed, output saved to ultimatum_output_data.csv"