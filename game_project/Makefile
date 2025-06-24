# Define services and script paths
DB_SERVICE=db
REDIS_SERVICE=redis
BACKEND_SERVICE=backend
FRONTEND_SERVICE=frontend
NGINX_SERVICE=nginx
MIGRATIONS_SCRIPT=./backend/run_migrations.sh

# Color definitions for pretty output
RED=\033[0;31m
GREEN=\033[0;32m
YELLOW=\033[0;33m
BLUE=\033[0;34m
RESET=\033[0m

# Default target that will be executed when running `make`
all: start-services run-migrations

# Start the DB service
start-db:
	@echo "$(BLUE)Starting DB service...$(RESET)"
	docker compose up -d $(DB_SERVICE)

# Start the Redis service
start-redis:
	@echo "$(BLUE)Starting Redis service...$(RESET)"
	docker compose up -d $(REDIS_SERVICE)

# Start the Backend service
start-backend:
	@echo "$(BLUE)Starting Backend service...$(RESET)"
	docker compose up -d $(BACKEND_SERVICE)

# Start the Frontend service
start-frontend:
	@echo "$(BLUE)Starting Frontend service...$(RESET)"
	docker compose up -d $(FRONTEND_SERVICE)

# Start all services together
start-services: start-db start-redis start-backend start-frontend
	@echo "$(BLUE)Building and starting all services...$(RESET)"
	docker compose up --build -d

# Run the migrations script for the backend
run-migrations:
	@echo "$(YELLOW)Running migrations...$(RESET)"
	$(MIGRATIONS_SCRIPT)

# Clean up all containers
clean:
	@echo "$(RED)Cleaning up containers...$(RESET)"
	docker compose down

# Clean up containers, volumes, and prune unused Docker resources
fclean:
	@echo "$(RED)Cleaning up containers and volumes...$(RESET)"
	docker image prune -f
	docker volume prune -f
	docker image prune -f
	docker system prune -f

# Show status of all services
status:
	@echo "$(GREEN)Checking status of all services...$(RESET)"
	docker compose ps

# Follow logs for all services
logs:
	@echo "$(BLUE)Following logs of all services...$(RESET)"
	docker compose logs -ff

# Rebuild and start all services
re: fclean all
	@echo "$(GREEN)Rebuilding and restarting all services...$(RESET)"
	docker compose up --build -d

# Stop all running services
stop:
	@echo "$(RED)Stopping all services...$(RESET)"
	docker compose stop

# Remove unused Docker volumes and images
docker-prune:
	@echo "$(YELLOW)Pruning unused Docker volumes and images...$(RESET)"
	docker compose down --volumes --remove-orphans 
	docker volume prune -f
	docker image prune -f
	docker system prune -f
