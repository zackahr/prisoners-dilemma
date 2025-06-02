#!/bin/bash

set -a
source ../.env 
set +a

docker-compose exec -T db psql -U postgres -d my_db < "../$SQL_FILE" > output_data.txt

echo "SQL query executed, output saved to output_data.txt" 