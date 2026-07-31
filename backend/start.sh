#!/bin/bash
set -e

echo "Applying database migrations..."
if [ -n "$DATABASE_URL" ]; then
    python manage.py migrate --noinput || echo "Warning: Migration failed. Check DATABASE_URL connection."
else
    echo "Warning: DATABASE_URL not set in environment."
fi

echo "Collecting static files..."
python manage.py collectstatic --noinput --clear || true

echo "Starting Gunicorn server on port ${PORT:-8000}..."
exec gunicorn --bind 0.0.0.0:${PORT:-8000} ffma.wsgi:application


