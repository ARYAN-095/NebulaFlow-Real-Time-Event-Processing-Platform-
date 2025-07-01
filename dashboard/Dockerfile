# 1) Build your Next.js "export" bundle
FROM node:18-alpine AS builder
WORKDIR /app

# Copy just the package files for a fast `npm ci`
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci

# Copy the rest of your app and build
COPY dashboard/ ./
RUN npm run build    # This now also does the static export thanks to output:'export'

# 2) Serve with Nginx
FROM nginx:stable-alpine
# Copy the exported HTML/CSS/JS into nginx’s html root
COPY --from=builder /app/out        /usr/share/nginx/html
COPY --from=builder /app/public     /usr/share/nginx/html

# Your custom Nginx config
COPY dashboard/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
