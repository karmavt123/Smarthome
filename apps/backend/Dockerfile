FROM node:20-slim

# Prisma engine can libssl - node:20-slim khong co san
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Dependencies truoc - layer nay chi build lai khi package.json doi.
#    KHONG dung --omit=dev: prisma CLI nam trong devDependencies.
COPY package.json package-lock.json ./
RUN npm ci

# 2) Prisma schema -> sinh client cho dung nen tang Linux.
#    DATABASE_URL gia chi de prisma.config.ts doc duoc luc build.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL="mysql://x:x@localhost:3306/x" npx prisma generate

# 3) Code
COPY . .

RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
