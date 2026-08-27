# ---------- stage build ----------
FROM node:20-slim AS build
WORKDIR /app

# scripts/ phai COPY TRUOC npm ci: package.json co postinstall goi
# scripts/download-face-models.mjs. Thieu file do la npm ci chet.
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci

COPY . .

# Vite thay the import.meta.env LUC BUILD, khong phai luc chay.
# "/api" (duong dan tuong doi) -> nginx proxy sang backend
# -> het CORS, va may khac vao bang IP LAN cung chay.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---------- stage chay ----------
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
