#!/usr/bin/env bash
set -euo pipefail

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$raiz"

for comando in php mariadb sudo openssl; do
  command -v "$comando" >/dev/null || { echo "Falta el comando requerido: $comando" >&2; exit 1; }
done

if ! php -m | grep -qi '^pdo_mysql$'; then
  echo "Falta la extensión PHP pdo_mysql. Instala php-mysqlnd y vuelve a ejecutar este script." >&2
  exit 1
fi

db_password="$(openssl rand -hex 24)"
mentor_code="$(openssl rand -hex 8)"
umask 077
cat > .env <<EOF
FIGHTCODE_DB_HOST=127.0.0.1
FIGHTCODE_DB_PORT=3306
FIGHTCODE_DB_NAME=fightcode
FIGHTCODE_DB_USER=fightcode_app
FIGHTCODE_DB_PASSWORD=$db_password
FIGHTCODE_MENTOR_CODE=$mentor_code
EOF

echo "Creando base y usuario dedicados; sudo puede solicitar tu contraseña."
sudo mariadb <<SQL
CREATE DATABASE IF NOT EXISTS fightcode CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'fightcode_app'@'127.0.0.1' IDENTIFIED BY '$db_password';
ALTER USER 'fightcode_app'@'127.0.0.1' IDENTIFIED BY '$db_password';
GRANT ALL PRIVILEGES ON fightcode.* TO 'fightcode_app'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

credenciales="$(mktemp)"
trap 'rm -f "$credenciales"' EXIT
chmod 600 "$credenciales"
cat > "$credenciales" <<EOF
[client]
host=127.0.0.1
port=3306
user=fightcode_app
password=$db_password
EOF
mariadb --defaults-extra-file="$credenciales" fightcode < base_datos/esquema.sql

echo "Base fightcode creada e importada. Configuración guardada en .env (no se sube a Git)."
echo "Código privado para registrar la primera cuenta Mentor: $mentor_code"
echo "Inicia el sitio con: php -S 127.0.0.1:8765 enrutador.php"
