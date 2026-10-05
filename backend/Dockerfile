# backend/Dockerfile
FROM node:20-alpine

# Crear directorio de trabajo
WORKDIR /app
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV SERVICE_DOCUMENT_BROWSER_PATH=/usr/bin/chromium

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias (sin devDependencies)
RUN npm ci --only=production

# Copiar el resto del código
COPY . .

# Exponer el puerto
EXPOSE 3001

# Comando para iniciar
CMD ["node", "src/index.js"]