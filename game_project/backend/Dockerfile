# Use official Python image as the base
FROM python:3.10

# Set working directory
WORKDIR /app

# Copy requirements.txt and install dependencies
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the rest of the application files (backend)
COPY . /app/


# Expose the port Django runs on
EXPOSE 8001

# Command to run Django application
CMD ["python", "manage.py", "runserver", "0.0.0.0:8001"]