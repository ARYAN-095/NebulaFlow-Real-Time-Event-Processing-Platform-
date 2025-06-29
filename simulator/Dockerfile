FROM node:18
WORKDIR /usr/src/simulator
COPY ../package.json ../package-lock.json ./
RUN npm ci --production
COPY . .
CMD ["node", "publisher.js", "--token", "${SIM_TOKEN}"]
