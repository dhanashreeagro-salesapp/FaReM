#!/bin/bash
set -e

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Starting server..."
exec gunicorn --bind 0.0.0.0:8000 ffma.wsgi:application
