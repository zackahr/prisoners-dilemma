FROM node:16 as build

WORKDIR /app

COPY ./package*.json ./

RUN npm install
RUN npm install react-router-dom --save
RUN npm install --force

COPY ./ ./
RUN npm run build

FROM nginx:alpine

# Copy the build files of the React app into the Nginx container
COPY --from=build /app/build /usr/share/nginx/html

# Simple nginx config for serving React app
RUN echo 'server { \
    listen 3000; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]