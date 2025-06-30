# api/Dockerfile

FROM node:18

WORKDIR /usr/src/api

# Copy package.json & lock file from root
COPY package.json package-lock.json ./

# Install only API-related deps (optional if shared)
RUN npm install

# Copy ONLY the API folder contents
COPY api/ ./

CMD [ "node", "server.js" ]
