.PHONY: install dev build check db-generate db-push db-studio up down clean
all: install db-generate db-push build 
	bun run start

install:
	bun install

dev:
	bun run dev

build:
	bun run build

check:
	bun run check

db-generate:
	bun run db:generate

db-push:
	bun run db:push

db-studio:
	bun run db:studio

up:
	docker-compose up -d

down:
	docker-compose down

clean:
	rm -rf node_modules .svelte-kit build
