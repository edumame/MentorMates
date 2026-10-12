FROM node:20-alpine
WORKDIR /app

# pnpm
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

RUN pnpm build

ENV NODE_ENV=production
ENV PORT=4001
EXPOSE 4001

CMD ["node", "dist/index.js"]
