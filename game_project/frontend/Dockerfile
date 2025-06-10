FROM node:16 as build

WORKDIR /app

COPY ./package*.json ./

RUN npm install
# Add this line to specifically install react-router-dom
RUN npm install react-router-dom --save
RUN npm install --force

COPY ./ ./
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache openssl

# Create directories for SSL certificates
RUN mkdir -p /etc/nginx/ssl

# Generate self-signed certificate (for local development only)
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx.key \
    -out /etc/nginx/ssl/nginx.crt \
    -subj "/C=MO/ST=RHAMNA/L=BENGRIR/O=1337/OU=1337/CN=localhost"

# Copy the build files of the React app into the Nginx container
COPY --from=build /app/build /usr/share/nginx/html

# Change ownership of the copied files to the nginx user
RUN chown -R nginx:nginx /usr/share/nginx/html

# Copy the custom Nginx config
COPY ./nginx.conf /etc/nginx/nginx.conf

# Expose HTTP and HTTPS ports
EXPOSE 80 443

# Command to run Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]