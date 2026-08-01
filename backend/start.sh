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

exec gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 3 --timeout 120 --keep-alive 65 ffma.wsgi:application



