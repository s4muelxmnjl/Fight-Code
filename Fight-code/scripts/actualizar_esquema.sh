#!/usr/bin/env bash
set -euo pipefail

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$raiz"
if [[ ! -r .env ]]; then
  echo "No existe .env. Ejecuta primero scripts/configurar_base_datos.sh." >&2
  exit 1
fi
for comando in mariadb mktemp; do
  command -v "$comando" >/dev/null || { echo "Falta el comando requerido: $comando" >&2; exit 1; }
done

db_user="$(sed -n 's/^FIGHTCODE_DB_USER=//p' .env | head -n 1)"
db_password="$(sed -n 's/^FIGHTCODE_DB_PASSWORD=//p' .env | head -n 1)"
db_host="$(sed -n 's/^FIGHTCODE_DB_HOST=//p' .env | head -n 1)"
db_port="$(sed -n 's/^FIGHTCODE_DB_PORT=//p' .env | head -n 1)"
db_name="$(sed -n 's/^FIGHTCODE_DB_NAME=//p' .env | head -n 1)"
if [[ -z "$db_user" || -z "$db_password" || -z "$db_host" || -z "$db_name" ]]; then
  echo "Faltan credenciales de base de datos en .env." >&2
  exit 1
fi

umask 077
credenciales="$(mktemp)"
trap 'rm -f "$credenciales"' EXIT
cat > "$credenciales" <<EOF
[client]
host=$db_host
port=${db_port:-3306}
user=$db_user
password=$db_password
EOF
mariadb --defaults-extra-file="$credenciales" "$db_name" < base_datos/esquema.sql
avatar_existente="$(mariadb --defaults-extra-file="$credenciales" "$db_name" -Nse "SHOW COLUMNS FROM usuarios LIKE 'avatar'")"
if [[ -z "$avatar_existente" ]]; then
  mariadb --defaults-extra-file="$credenciales" "$db_name" -e "ALTER TABLE usuarios ADD COLUMN avatar VARCHAR(80) NULL DEFAULT NULL AFTER identificacion"
fi
apellido_existente="$(mariadb --defaults-extra-file="$credenciales" "$db_name" -Nse "SHOW COLUMNS FROM usuarios LIKE 'apellido'")"
if [[ -z "$apellido_existente" ]]; then
  mariadb --defaults-extra-file="$credenciales" "$db_name" -e "ALTER TABLE usuarios ADD COLUMN apellido VARCHAR(80) NOT NULL DEFAULT '' AFTER nombre"
fi
identificacion_existente="$(mariadb --defaults-extra-file="$credenciales" "$db_name" -Nse "SHOW COLUMNS FROM usuarios LIKE 'identificacion'")"
if [[ -z "$identificacion_existente" ]]; then
  mariadb --defaults-extra-file="$credenciales" "$db_name" -e "ALTER TABLE usuarios ADD COLUMN identificacion VARCHAR(30) NULL DEFAULT NULL AFTER apellido"
fi
indice_identificacion="$(mariadb --defaults-extra-file="$credenciales" "$db_name" -Nse "SHOW INDEX FROM usuarios WHERE Key_name='usuarios_identificacion_uq'")"
if [[ -z "$indice_identificacion" ]]; then
  mariadb --defaults-extra-file="$credenciales" "$db_name" -e "ALTER TABLE usuarios ADD UNIQUE KEY usuarios_identificacion_uq (identificacion)"
fi
canal_existente="$(mariadb --defaults-extra-file="$credenciales" "$db_name" -Nse "SHOW COLUMNS FROM contenido LIKE 'canal'")"
if [[ -z "$canal_existente" ]]; then
  mariadb --defaults-extra-file="$credenciales" "$db_name" -e "ALTER TABLE contenido ADD COLUMN canal ENUM('anuncios','comunidad') NOT NULL DEFAULT 'anuncios' AFTER tipo"
fi
modulo_contenido_existente="$(mariadb --defaults-extra-file="$credenciales" "$db_name" -Nse "SHOW COLUMNS FROM contenido LIKE 'modulo_slug'")"
if [[ -z "$modulo_contenido_existente" ]]; then
  mariadb --defaults-extra-file="$credenciales" "$db_name" -e "ALTER TABLE contenido ADD COLUMN modulo_slug VARCHAR(90) NULL DEFAULT NULL AFTER canal"
fi
indice_contenido_modulo="$(mariadb --defaults-extra-file="$credenciales" "$db_name" -Nse "SHOW INDEX FROM contenido WHERE Key_name='contenido_modulo_publicado_idx'")"
if [[ -z "$indice_contenido_modulo" ]]; then
  mariadb --defaults-extra-file="$credenciales" "$db_name" -e "ALTER TABLE contenido ADD INDEX contenido_modulo_publicado_idx (modulo_slug, publicado, actualizado_en)"
fi
echo "Esquema actualizado correctamente."
