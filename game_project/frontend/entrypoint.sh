#!/bin/sh

echo "Starting entrypoint script..."

# Function to start nginx with HTTP-only config
start_http_nginx() {
    echo "Starting nginx with HTTP-only configuration..."
    cat > /etc/nginx/nginx.conf << 'EOF'
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    upstream backend {
        server backend:8001;
    }

    server {
        listen 80;
        server_name gametheory.socialinteractionlab.org;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
            try_files $uri =404;
        }
        
        location / {
            root /usr/share/nginx/html;
            index index.html index.htm;
            try_files $uri $uri/ /index.html;
        }
        
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF
}

# Function to restore full SSL config
restore_ssl_nginx() {
    echo "Restoring full SSL nginx configuration..."
    cp /etc/nginx/nginx.conf.ssl /etc/nginx/nginx.conf
}

# Backup the original SSL config
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.ssl

# Check if we're in production and have a real domain
if [ "$ENVIRONMENT" = "production" ] && [ "$DOMAIN" != "localhost" ] && [ -n "$DOMAIN" ]; then
    echo "Production environment detected for domain: $DOMAIN"
    
    # Check if certificate already exists
    if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        echo "No existing certificate found. Setting up HTTP-only first..."
        
        # Start with HTTP-only configuration
        start_http_nginx
        
        # Test and start nginx
        nginx -t && nginx -g "daemon off;" &
        NGINX_PID=$!
        
        # Wait for nginx to start
        sleep 10
        
        echo "Attempting to obtain Let's Encrypt certificate for $DOMAIN..."
        
        # Get certificate using webroot method
        certbot certonly \
            --webroot \
            --webroot-path=/var/www/certbot \
            --non-interactive \
            --agree-tos \
            --email "$EMAIL" \
            -d "$DOMAIN" \
            --verbose
        
        if [ $? -eq 0 ]; then
            echo "Certificate obtained successfully!"
            # Kill nginx and restart with SSL
            kill $NGINX_PID 2>/dev/null
            wait $NGINX_PID 2>/dev/null
            sleep 5
            
            # Restore SSL configuration
            restore_ssl_nginx
        else
            echo "Failed to obtain certificate. Continuing with HTTP-only..."
            # Keep HTTP-only config
        fi
    else
        echo "Certificate already exists for $DOMAIN"
        # Use SSL config
        restore_ssl_nginx
    fi
    
    # Set up certificate renewal cron job
    echo "0 12 * * * /usr/local/bin/certbot-renew.sh" | crontab -
    crond -b
    echo "Certificate renewal cron job set up"
else
    echo "Development environment or localhost detected, using HTTP-only"
    start_http_nginx
fi

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "Nginx configuration is valid. Starting nginx..."
    # If nginx is already running, stop it first
    nginx -s quit 2>/dev/null || true
    sleep 2
    # Start nginx in foreground
    exec nginx -g "daemon off;"
else
    echo "Nginx configuration test failed!"
    # Try with HTTP-only as fallback
    echo "Falling back to HTTP-only configuration..."
    start_http_nginx
    nginx -t && exec nginx -g "daemon off;"
fi