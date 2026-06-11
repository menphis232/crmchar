FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Expose the API port
EXPOSE 3000

# Start the Node.js server
CMD ["node", "src/index.js"]
