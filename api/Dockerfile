FROM node:18-alpine
WORKDIR /usr/src/api
COPY ../package.json ../package-lock.json ./
RUN npm ci --production
COPY . .
CMD ["node", "server.js"]
