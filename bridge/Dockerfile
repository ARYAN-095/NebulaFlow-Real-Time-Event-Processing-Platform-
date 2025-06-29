FROM node:18-alpine
WORKDIR /usr/src/bridge
COPY ../package.json ../package-lock.json ./
RUN npm ci --production
COPY . .
CMD ["node", "subscriber.js"]
