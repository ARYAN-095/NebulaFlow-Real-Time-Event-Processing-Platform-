FROM node:18-alpine
WORKDIR /usr/src/consumer
COPY ../package.json ../package-lock.json ./
RUN npm ci --production
COPY consumer/ .
CMD ["node", "kafka-consumer.js"]
