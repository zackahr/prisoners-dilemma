set -a
source ../.env
set +a

docker-compose exec -T db psql -U postgres -d "$DB_NAME" < "../$SQL_FILE" > output_data.csv

echo "SQL query executed, output saved to output_data.csv"