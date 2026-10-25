-- En phpMyAdmin crea y selecciona una base llamada fightcode, luego importa este archivo.
-- Compatible con MySQL 8+ y MariaDB 10.5+.

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  apellido VARCHAR(80) NOT NULL DEFAULT '',
  identificacion VARCHAR(30) NULL DEFAULT NULL,
  avatar VARCHAR(80) NULL DEFAULT NULL,
  correo VARCHAR(254) NOT NULL UNIQUE,
  hash_clave VARCHAR(255) NOT NULL,
  rol ENUM('coder','mentor') NOT NULL DEFAULT 'coder',
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY usuarios_identificacion_uq (identificacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sesiones (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  expira_en BIGINT UNSIGNED NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX sesiones_usuario_idx (usuario_id),
  INDEX sesiones_expiracion_idx (expira_en),
  CONSTRAINT sesiones_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS acceso_intentos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  fingerprint CHAR(64) NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX acceso_fingerprint_fecha_idx (fingerprint, creado_en),
  INDEX acceso_fecha_idx (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mentor_invitaciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  creado_por BIGINT UNSIGNED NULL,
  expira_en DATETIME NOT NULL,
  usado_en DATETIME NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX mentor_invitacion_expira_idx (expira_en),
  CONSTRAINT mentor_invitacion_creador_fk FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resultados_quiz (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  modulo VARCHAR(80) NOT NULL,
  correctas SMALLINT UNSIGNED NOT NULL,
  incorrectas SMALLINT UNSIGNED NOT NULL,
  total SMALLINT UNSIGNED NOT NULL,
  porcentaje TINYINT UNSIGNED NOT NULL,
  reflexion_aprendizaje TEXT NOT NULL,
  reflexion_dificultades TEXT NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX resultados_usuario_idx (usuario_id, creado_en),
  CONSTRAINT resultados_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asistencia (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  coder_id BIGINT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  estado ENUM('presente','ausente','tarde','justificada') NOT NULL,
  nota VARCHAR(1000) NOT NULL DEFAULT '',
  mentor_id BIGINT UNSIGNED NOT NULL,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY asistencia_coder_dia_uq (coder_id, fecha),
  INDEX asistencia_fecha_idx (fecha),
  CONSTRAINT asistencia_coder_fk FOREIGN KEY (coder_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT asistencia_mentor_fk FOREIGN KEY (mentor_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contenido (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(140) NOT NULL,
  tipo ENUM('anuncio','material','enlace') NOT NULL,
  canal ENUM('anuncios','comunidad') NOT NULL DEFAULT 'anuncios',
  modulo_slug VARCHAR(90) NULL DEFAULT NULL,
  cuerpo TEXT NOT NULL,
  url VARCHAR(1000) NOT NULL DEFAULT '',
  publicado TINYINT(1) NOT NULL DEFAULT 1,
  mentor_id BIGINT UNSIGNED NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX contenido_publicado_idx (publicado, actualizado_en),
  INDEX contenido_modulo_publicado_idx (modulo_slug, publicado, actualizado_en),
  CONSTRAINT contenido_mentor_fk FOREIGN KEY (mentor_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS foro_comentarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  contenido_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  cuerpo TEXT NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX foro_comentarios_orden_idx (contenido_id, creado_en),
  CONSTRAINT foro_comentarios_contenido_fk FOREIGN KEY (contenido_id) REFERENCES contenido(id) ON DELETE CASCADE,
  CONSTRAINT foro_comentarios_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS modulos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(90) NOT NULL UNIQUE,
  titulo VARCHAR(120) NOT NULL,
  resumen VARCHAR(1000) NOT NULL DEFAULT '',
  nivel VARCHAR(40) NOT NULL DEFAULT 'Inicial',
  duracion VARCHAR(80) NOT NULL DEFAULT '',
  icono VARCHAR(80) NOT NULL DEFAULT '</>',
  publicado TINYINT(1) NOT NULL DEFAULT 0,
  estructura JSON NOT NULL,
  mentor_id BIGINT UNSIGNED NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX modulos_publicado_orden_idx (publicado, actualizado_en),
  CONSTRAINT modulos_mentor_fk FOREIGN KEY (mentor_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bitacora (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT UNSIGNED NULL,
  actor_nombre VARCHAR(80) NOT NULL DEFAULT 'Sistema',
  accion VARCHAR(80) NOT NULL,
  objetivo VARCHAR(140) NOT NULL DEFAULT '',
  detalles JSON NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX bitacora_fecha_idx (creado_en),
  CONSTRAINT bitacora_actor_fk FOREIGN KEY (actor_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fight_records (
  usuario_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  victorias INT UNSIGNED NOT NULL DEFAULT 0,
  derrotas INT UNSIGNED NOT NULL DEFAULT 0,
  empates INT UNSIGNED NOT NULL DEFAULT 0,
  puntos INT UNSIGNED NOT NULL DEFAULT 0,
  dano_total INT UNSIGNED NOT NULL DEFAULT 0,
  peleas INT UNSIGNED NOT NULL DEFAULT 0,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX pelea_ranking_idx (puntos DESC, victorias DESC, dano_total DESC, peleas ASC),
  CONSTRAINT pelea_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reuniones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(140) NOT NULL,
  descripcion TEXT NOT NULL,
  inicia_en DATETIME NOT NULL,
  termina_en DATETIME NOT NULL,
  enlace_meet VARCHAR(1000) NOT NULL,
  mentor_id BIGINT UNSIGNED NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX reuniones_fecha_idx (inicia_en),
  CONSTRAINT reuniones_mentor_fk FOREIGN KEY (mentor_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
