FROM oven/bun:1 AS builder

WORKDIR /app

# Install dependencies with frozen lockfile for reproducible builds
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Build SvelteKit app
RUN bun run build

FROM oven/bun:1-slim AS runner

WORKDIR /app

# Copy only production artifacts
COPY --from=builder /app/build build/
COPY --from=builder /app/package.json .

EXPOSE 3000

ENV NODE_ENV=production

CMD ["bun", "run", "./build/index.js"]
