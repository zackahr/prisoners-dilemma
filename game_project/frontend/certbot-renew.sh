#!/bin/sh

echo "Starting certificate renewal check..."

# Renew certificates
certbot renew --quiet --webroot --webroot-path=/var/www/certbot

# Check if renewal was successful
if [ $? -eq 0 ]; then
    echo "Certificate renewal successful or not needed"
    # Reload nginx to use new certificates
    nginx -s reload
    echo "Nginx reloaded"
else
    echo "Certificate renewal failed"
fi

echo "Certificate renewal check completed"