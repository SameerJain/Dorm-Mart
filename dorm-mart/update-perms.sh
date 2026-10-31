#!/bin/bash
# Set sane permissions for a deployed copy of the app, run from dorm-mart/.
#
# Directories 755 and files 644 (owner can write, everyone else can read).
# Only the upload directories need to be writable by the web server user;
# they get 775 so the owner and the server's group can write. This replaces
# the old `chmod -R 777 .`, which let any local user modify the code.
#
# Pass the web server's group to also hand it the upload directories:
#   ./update-perms.sh www-data

set -euo pipefail

WEB_GROUP="${1:-}"

find . -path ./node_modules -prune -o -type d -exec chmod 755 {} +
find . -path ./node_modules -prune -o -type f -exec chmod 644 {} +

# Scripts that are meant to be run directly stay executable.
find . -path ./node_modules -prune -o -type f -name '*.sh' -exec chmod 755 {} +

UPLOAD_DIRS=(images media "${DATA_UPLOADS_DIR:-}")
for dir in "${UPLOAD_DIRS[@]}"; do
  [ -n "$dir" ] && [ -d "$dir" ] || continue
  chmod -R 775 "$dir"
  if [ -n "$WEB_GROUP" ]; then
    chgrp -R "$WEB_GROUP" "$dir"
  fi
done

echo "Permissions updated in $(pwd): code is 644/755, upload directories are 775."
