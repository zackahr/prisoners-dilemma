# Use official Python image as the base
FROM python:3.10-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PIP_DEFAULT_TIMEOUT=100

# Set working directory
WORKDIR /app

# System dependencies required for psycopg2 and other packages
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the rest of the backend code
COPY . /app/

# Expose Django port
EXPOSE 8001

# Run Django development server
CMD ["python", "manage.py", "runserver", "0.0.0.0:8001"]
