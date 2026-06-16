# ---- Build Stage ----
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache ffmpeg
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec prisma generate
ENV DATABASE_URL=postgresql://bible:bible123@db:5432/bible365
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- Runtime Stage ----
FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache ffmpeg curl
RUN corepack enable

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src

RUN mkdir -p uploads

EXPOSE 3000 3001

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]