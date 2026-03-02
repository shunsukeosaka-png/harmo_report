FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY src ./src
COPY migrations ./migrations

EXPOSE 3000
CMD ["sh", "-c", "npm run migrate && npm start"]
