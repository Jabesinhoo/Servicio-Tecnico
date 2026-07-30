# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar dependencias
COPY package*.json ./
RUN npm ci

# Copiar código y construir
COPY . .
RUN npm run build

# ============================================================
# Segunda etapa - Servir la aplicación
# ============================================================
FROM node:20-alpine

WORKDIR /app

# Instalar serve para servir los archivos estáticos
RUN npm install -g serve

# Copiar los archivos construidos
COPY --from=builder /app/dist ./dist

EXPOSE 5173

# Usar serve para servir los archivos estáticos
CMD ["serve", "-s", "dist", "-l", "5173"]