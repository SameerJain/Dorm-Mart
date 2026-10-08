# Production image for Railway: React build + PHP under Apache.
#
# Replaces `php -S` (PHP's built-in development server) from the Procfile.
# Apache's prefork workers handle concurrent requests, enforce request
# timeouts, and are hardened below. All requests still go through router.php,
# so routing and security headers are unchanged.

# ---------------------------------------------------------------------------
# Stage 1: React production bundle
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS frontend
WORKDIR /app

# Railway passes service variables to Docker builds only when declared as ARG.
ARG REACT_APP_API_BASE
ARG REACT_APP_CHAT_NOTIFICATION_ON
# PUBLIC_URL=/ keeps asset paths absolute. package.json's "homepage": "."
# would emit ./static/..., which 404s (as index.html) when a nested route such
# as /app/listings is loaded directly. Railway's old build command set this.
ENV REACT_APP_API_BASE=$REACT_APP_API_BASE \
    REACT_APP_CHAT_NOTIFICATION_ON=$REACT_APP_CHAT_NOTIFICATION_ON \
    GENERATE_SOURCEMAP=false \
    PUBLIC_URL=/

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY public ./public
COPY src ./src
COPY tailwind.config.js postcss.config.js .eslintrc.json ./
# Same script Railway ran before (source maps off). Fail the image if any map slips in.
RUN npm run build \
 && if find build -name '*.map' | grep -q .; then echo 'source maps found in build' >&2; exit 1; fi

# ---------------------------------------------------------------------------
# Stage 2: PHP dependencies (restores the gitignored banbuilder word list)
# ---------------------------------------------------------------------------
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist \
        --no-scripts --no-autoloader --ignore-platform-reqs \
 && composer dump-autoload --no-dev --optimize --no-scripts

# ---------------------------------------------------------------------------
# Stage 3: runtime
# ---------------------------------------------------------------------------
FROM php:8.3-apache-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends libpng-dev libjpeg62-turbo-dev libwebp-dev \
 && docker-php-ext-configure gd --with-jpeg --with-webp \
 && docker-php-ext-install -j"$(nproc)" mysqli gd \
 && apt-get purge -y --auto-remove libpng-dev libjpeg62-turbo-dev libwebp-dev \
 && apt-get install -y --no-install-recommends libpng16-16 libjpeg62-turbo libwebp7 \
 && rm -rf /var/lib/apt/lists/*

RUN a2enmod rewrite headers \
 && a2dismod -f autoindex status

COPY docker/php.ini /usr/local/etc/php/conf.d/zz-dorm-mart.ini
# "zz-" so it loads after Debian's security.conf, which would otherwise
# re-enable the version banner (ServerTokens OS, ServerSignature On).
COPY docker/apache-security.conf /etc/apache2/conf-available/zz-dorm-mart-security.conf
COPY docker/apache-site.conf /etc/apache2/sites-available/000-default.conf
COPY docker/start.sh /usr/local/bin/dorm-mart-start
RUN a2enconf zz-dorm-mart-security \
 && sed -i 's/^Listen 80$/Listen ${PORT}/' /etc/apache2/ports.conf \
 && sed -i 's/\r$//' /usr/local/bin/dorm-mart-start \
 && chmod 0755 /usr/local/bin/dorm-mart-start

WORKDIR /var/www/html
COPY --chown=root:root . .
COPY --from=vendor --chown=root:root /app/vendor ./vendor
COPY --from=frontend --chown=root:root /app/build ./build

# Code is root-owned and read-only to the web server. Only the upload volume
# (DATA_UPLOADS_DIR) is handed to www-data at start-up.
# The base image leaves /var/www/html owned by www-data; take it back so the
# web server cannot create files beside the code.
RUN chown root:root /var/www/html \
 && find . -type d -exec chmod 0755 {} + \
 && find . -type f -exec chmod 0644 {} +

ENV PORT=8080
EXPOSE 8080

# CMD, not ENTRYPOINT, so a Railway start command (the promotional-digest
# cron service) replaces it cleanly.
CMD ["dorm-mart-start"]
