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

# Railway has re-enabled mpm_event beside mod_php's mpm_prefork at runtime
# ("AH00534: More than one MPM loaded") on an image whose build-time config
# test passes and which runs fine under local Docker. Pin the MPM here, where
# it runs against the live filesystem. mod_php needs prefork.
rm -f /etc/apache2/mods-enabled/mpm_event.* /etc/apache2/mods-enabled/mpm_worker.*
a2enmod mpm_prefork >/dev/null

# Fail with the evidence in the deploy log rather than a bare AH00534.
if ! apache2ctl -t; then
    echo "Apache config test failed. Enabled MPMs:" >&2
    ls -la /etc/apache2/mods-enabled | grep -i mpm >&2 || true
    grep -rniE 'LoadModule +mpm_' /etc/apache2 >&2 || true
    exit 1
fi

exec apache2-foreground
