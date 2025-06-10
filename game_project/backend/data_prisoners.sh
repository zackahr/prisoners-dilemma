set -a
source ../.env
set +a

docker-compose exec -T db psql -U postgres -d "$DB_NAME" < "../$SQL_FILE_PRISONERS" > output_data.csv

echo "SQL query executed, output saved to output_data.csv"