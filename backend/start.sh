#!/bin/bash
set -e

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput --clear || true

echo "Starting server..."
exec gunicorn --bind 0.0.0.0:${PORT:-8000} ffma.wsgi:application

