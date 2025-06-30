# bridge/Dockerfile
FROM node:18-alpine

# 1️⃣ Set working dir
WORKDIR /usr/src/bridge

# 2️⃣ Copy package.json from ROOT of context (not ../)
COPY package.json package-lock.json ./

# 3️⃣ Install dependencies
RUN npm ci --production

# 4️⃣ Copy only bridge source files
COPY bridge/ .

# 5️⃣ Entry point
CMD ["node", "subscriber.js"]
