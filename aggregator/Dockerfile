FROM node:18-alpine
WORKDIR /usr/src/aggregator
COPY package.json package-lock.json ./
RUN npm ci --production
COPY aggregator/. .
CMD ["node", "index.js"]
