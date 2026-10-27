# PARTE DEL ENTORNO FIGHT+ - FUNDACIÓN CREADA PARA NUESTROS PELEADORES.

# FIGHT+ CODE

Plataforma educativa con acceso por roles, rutas de aprendizaje, evaluaciones, control de asistencia, administración de contenidos y un minijuego de combate con clasificación por cuenta.

## Requisitos

- PHP 8.1 o posterior.
- Extensiones `pdo_mysql` y `mbstring` habilitadas.
- MySQL 8+ o MariaDB 10.5+.

## Crear la base de datos

Con PHP, PDO MySQL, MariaDB y el servicio MariaDB instalados y activos, ejecuta desde la raíz del proyecto:

```bash
bash scripts/configurar_base_datos.sh
```

Este script crea la base `fightcode`, un usuario MySQL dedicado con permisos solo sobre esa base, importa [`base_datos/esquema.sql`](base_datos/esquema.sql) y genera `.env` con credenciales aleatorias y un código privado de mentor. El código de mentor se muestra al terminar para que puedas registrar la primera cuenta administrativa. `.env` está ignorado por Git.

Cuando agregues cambios al esquema, aplica las tablas nuevas existentes con `bash scripts/actualizar_esquema.sh`.

## Ejecutar

```bash
php -S 127.0.0.1:8765 enrutador.php
```

Abre `http://127.0.0.1:8765`. Usa siempre esa dirección; al abrir los `.html` como archivos, el servidor y las API no están disponibles. Inicia MariaDB antes de ejecutar PHP. Para entrar a cualquier sección de la plataforma se debe iniciar sesión. La pantalla de cuenta permanece disponible para registrarse o acceder. El perfil requiere una cuenta y el panel, los borradores y las funciones administrativas son exclusivos de mentores registrados con invitación.

Las contraseñas se almacenan con `password_hash()`, los cambios de perfil requieren la contraseña actual y al cambiar la contraseña se revocan las sesiones anteriores. La API limita intentos de acceso, valida el origen de las solicitudes que modifican datos y los permisos de mentor se comprueban en servidor. Las invitaciones de mentor son aleatorias, de un solo uso y vencen a los siete días; el código de configuración inicial también se invalida al usarse. Ejecuta `bash scripts/actualizar_esquema.sh` después de actualizar para crear las tablas de intentos e invitaciones. Para producción usa un usuario MySQL dedicado, HTTPS, configura `FIGHTCODE_SECURE_COOKIE=1` y establece `FIGHTCODE_ORIGIN` con el origen público exacto.

## Estructura

- `index.html`: portada y sección Quiénes somos.
- `paginas/`: cuenta, panel de mentor, ruta, cuestionario, retos y documentación.
- `paginas/perfil.html`: área privada para editar la cuenta y administrar la foto de perfil.
- `paginas/foro.html`: tablón de anuncios y conversaciones de comunidad.
- `modulos/`: módulo Python Básico.
- `api/index.php`: API de autenticación, resultados y administración.
- `scripts/pelea.js` y `styles/pelea.css`: combate arcade, controles, música y ranking Fight Night.
- `img/luchadores/`: personajes del ring con fondo transparente.
- `fight_records`: victorias, derrotas, empates, puntos y daño acumulado de cada cuenta.
- `foro_comentarios`: comentarios de la comunidad vinculados a publicaciones y usuarios.
- `paginas/administracion.html`: panel de mentor, incluye el editor de módulos y quizzes.
- `modulos/modulo.html`: plantilla pública para los módulos creados desde el panel.
- `config/base_datos.php`: conexión PDO a MySQL/MariaDB.
- `base_datos/esquema.sql`: tablas y relaciones.
- `enrutador.php`: acceso obligatorio y control de permisos en las páginas.
- `styles/`: estilos compartidos y temas claro/oscuro.
- `scripts/`: comportamiento de las páginas y panel administrativo.
- `img/`: logos.
- `src/sonidos/`: sonidos de respuesta del cuestionario.
- `documentos/`: guía descargable de retos.
