#!/bin/sh
# Container start-up for the web service.
set -eu

export PORT="${PORT:-8080}"

# Railway mounts the upload volume owned by root. Apache workers run as
# www-data, so hand the volume to them; code directories stay root-owned.
if [ -n "${DATA_UPLOADS_DIR:-}" ] && [ -d "$DATA_UPLOADS_DIR" ]; then
    mkdir -p "$DATA_UPLOADS_DIR/images" "$DATA_UPLOADS_DIR/media"
    chown -R www-data:www-data "$DATA_UPLOADS_DIR"
fi

exec apache2-foreground
