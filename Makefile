.PHONY: all setup setup-dev build build-dev logs logs-frontend logs-backend \
	run run-dev stop shell shell-frontend shell-backend help

all: help

uid := $(shell id -u)
gid := $(shell id -g)

PROJECT_NAME := sh8r

setup: build
	@echo "sh8r production setup complete."

setup-dev: build-dev
	@echo "sh8r development setup complete."

build-dev:
	@echo "Building development images..."
	uid=$(uid) gid=$(gid) docker compose -p $(PROJECT_NAME) --profile dev build

build:
	@echo "Building production images..."
	uid=$(uid) gid=$(gid) docker compose -p $(PROJECT_NAME) --profile prod build

logs:
	logs-frontend
	logs-backend

logs-frontend:
	@docker logs sh8r-frontend

logs-backend:
	@docker logs sh8r-backend

shell:
	@echo "Available containers:"
	@echo "  backend  - Backend container shell"
	@echo "  frontend - Frontend container shell"
	@echo "Usage: make shell-<container>"

shell-frontend:
	@docker exec -it sh8r-frontend /bin/sh

shell-backend:
	@docker exec -it sh8r-backend /bin/sh

run-dev:
	@echo "Starting sh8r in development mode..."
	$(MAKE) stop
	@if [ -z "$$(docker images -q sh8r-backend-dev)" ]; then \
		echo "Development images not found. Building..."; \
		$(MAKE) build-dev; \
	fi
	docker compose -p $(PROJECT_NAME) --profile dev up

run:
	@echo "Starting sh8r in production mode..."
	$(MAKE) stop
	@if [ -z "$$(docker images -q sh8r-backend)" ]; then \
		echo "Production images not found. Building..."; \
		$(MAKE) build; \
	fi
	docker compose -p $(PROJECT_NAME) --profile prod up -d

stop:
	@echo "Stopping sh8r services..."
	@docker compose -p $(PROJECT_NAME) --profile dev down 2>/dev/null || true
	@docker compose -p $(PROJECT_NAME) --profile prod down 2>/dev/null || true
	@echo "All services stopped."

help:
	@echo '===================='
	@echo '   SH8R - MAKEFILE   '
	@echo '===================='
	@echo ''
	@echo 'Setup Commands:'
	@echo '  setup               - Production setup (build)'
	@echo '  setup-dev           - Development setup (build-dev)'
	@echo ''
	@echo 'Build Commands:'
	@echo '  build               - Build production images'
	@echo '  build-dev           - Build development images'
	@echo ''
	@echo 'Run Commands:'
	@echo '  run                 - Run in production mode'
	@echo '  run-dev             - Run in development mode with hot-reload'
	@echo ''
	@echo 'Logging Commands:'
	@echo '  logs                - Show logs'
	@echo '  logs-frontend        - Show frontend logs'
	@echo '  logs-backend         - Show backend logs'
	@echo ''
	@echo 'Shell Access:'
	@echo '  shell-frontend       - Access frontend container shell'
	@echo '  shell-backend        - Access backend container shell'
	@echo ''
	@echo 'Maintenance Commands:'
	@echo '  stop                - Stop containers'
	@echo '===================='
