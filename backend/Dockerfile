# Use an official Python runtime as a parent image
FROM python:3.12-slim-bookworm

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies, including GDAL and PostGIS requirements
RUN apt-get update && apt-get install -y \
    binutils \
    libproj-dev \
    gdal-bin \
    libgdal-dev \
    python3-gdal \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy the rest of the application
ENV REBUILD_TRIGGER_TIMESTAMP=20260810_102830
COPY . /app/

# Collect static files (optional, depending on if you serve them from Django)
# RUN python manage.py collectstatic --noinput

# Copy the start script and make it executable
COPY start.sh /app/
RUN sed -i 's/\r$//' /app/start.sh
RUN chmod +x /app/start.sh


# Expose port
EXPOSE 8000

# The startup command is managed by render.yaml, but we provide a default
CMD ["/app/start.sh"]
