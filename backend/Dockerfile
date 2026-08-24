FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Expose the API port
EXPOSE 3000

# Apply idempotent migrations before starting the API
CMD ["sh", "-c", "node src/migrate.js && node src/index.js"]
