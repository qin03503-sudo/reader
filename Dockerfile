FROM oven/bun:latest AS builder

WORKDIR /app

COPY package*.json bun.lock ./
RUN bun install

COPY . .

# Run DB Migrations (if applicable) and build SvelteKit
RUN bun run build

FROM oven/bun:1-slim AS runner

WORKDIR /app

# Copy ONLY the build folder and package.json
COPY --from=builder /app/build build/
COPY package.json .

EXPOSE 3000

ENV NODE_ENV=production

CMD ["bun", "./build/index.js"]
