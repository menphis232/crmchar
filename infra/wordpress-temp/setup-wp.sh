#!/bin/bash
set -euo pipefail

DOMAIN="${WP_DOMAIN:-http://wp.2.25.197.82.sslip.io}"
TITLE="WordPress Temporal"
ADMIN_USER="menphisj"
ADMIN_PASS='24%camila'
ADMIN_EMAIL="menphisj@gmail.com"

echo "[1/4] Esperando WordPress..."
for i in $(seq 1 40); do
  if docker exec wordpress-temp curl -sf http://127.0.0.1/ >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

echo "[2/4] Instalando WordPress core si hace falta..."
if ! docker exec wordpress-temp-cli wp core is-installed 2>/dev/null; then
  docker exec wordpress-temp-cli wp core install \
    --url="$DOMAIN" \
    --title="$TITLE" \
    --admin_user="$ADMIN_USER" \
    --admin_password="$ADMIN_PASS" \
    --admin_email="$ADMIN_EMAIL" \
    --skip-email
else
  echo "WordPress ya estaba instalado; actualizando admin..."
  docker exec wordpress-temp-cli wp user update "$ADMIN_USER" \
    --user_pass="$ADMIN_PASS" \
    --user_email="$ADMIN_EMAIL" 2>/dev/null \
  || docker exec wordpress-temp-cli wp user create "$ADMIN_USER" "$ADMIN_EMAIL" \
    --role=administrator \
    --user_pass="$ADMIN_PASS"
fi

echo "[3/4] Ajustando URL y permisos..."
docker exec wordpress-temp-cli wp option update home "$DOMAIN"
docker exec wordpress-temp-cli wp option update siteurl "$DOMAIN"
docker exec wordpress-temp bash -c 'chown -R www-data:www-data /var/www/html && chmod -R u+w /var/www/html'

echo "[4/4] Instalando All-in-One WP Migration..."
docker exec wordpress-temp-cli wp plugin install all-in-one-wp-migration --activate --force

echo "OK"
docker exec wordpress-temp-cli wp plugin list
docker exec wordpress-temp-cli wp user list --fields=ID,user_login,user_email,roles
