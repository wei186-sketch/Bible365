FROM node:20-alpine
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec prisma generate
RUN pnpm build

EXPOSE 3000
CMD ["sh", "-c", "pnpm exec prisma db push && pnpm start"]

