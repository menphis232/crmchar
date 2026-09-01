# Etapa 1: Compilación
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build --configuration=production && node scripts/patch-ngsw-onesignal.js

# Etapa 2: Servidor Web Nginx
FROM nginx:alpine
# Copiamos la build de Angular a la carpeta que sirve Nginx
COPY --from=build /app/dist/tramites-frontend/browser /usr/share/nginx/html

# Copiamos una configuración de Nginx para que el enrutamiento de Angular funcione
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
