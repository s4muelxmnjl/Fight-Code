<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/base_datos.php';

function responder(int $status, array $data, array $headers = []): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    foreach ($headers as $name => $value) {
        header($name . ': ' . $value);
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function leerJson(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) < 2 || strlen($raw) > 2_097_152) {
        responder(400, ['error' => 'El contenido enviado no es válido.']);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        responder(400, ['error' => 'No se pudo leer la solicitud.']);
    }
    return $data;
}

function validarOrigenMutacion(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '' && !empty($_SERVER['HTTP_REFERER'])) {
        $parts = parse_url((string)$_SERVER['HTTP_REFERER']);
        if (is_array($parts) && isset($parts['scheme'], $parts['host'])) {
            $origin = $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '');
        }
    }
    $expected = getenv('FIGHTCODE_ORIGIN') ?: '';
    if ($expected === '') {
        $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        // cloudflared termina HTTPS y reenvía al servidor local por HTTP.
        // Toma en cuenta el protocolo original que reporta el proxy.
        $forwardedProto = strtolower(trim(explode(',', (string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0]));
        if (in_array($forwardedProto, ['http', 'https'], true)) {
            $https = $forwardedProto === 'https';
        }
        $expected = ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? '');
    }
    if ($origin === '' || $expected === '' || !hash_equals(rtrim($expected, '/'), rtrim($origin, '/'))) {
        responder(403, ['error' => 'Origen de solicitud no permitido. Recarga la página e inténtalo de nuevo.']);
    }
}

function limitarIntentos(PDO $db, string $fingerprint, int $max = 8): void
{
    $db->exec('DELETE FROM acceso_intentos WHERE creado_en < DATE_SUB(NOW(), INTERVAL 1 DAY)');
    $query = $db->prepare('SELECT COUNT(*) FROM acceso_intentos WHERE fingerprint=? AND creado_en >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)');
    $query->execute([$fingerprint]);
    if ((int)$query->fetchColumn() >= $max) {
        responder(429, ['error' => 'Demasiados intentos. Espera 15 minutos antes de intentarlo de nuevo.'], ['Retry-After' => '900']);
    }
    $db->prepare('INSERT INTO acceso_intentos(fingerprint) VALUES(?)')->execute([$fingerprint]);
}

function usuarioActual(PDO $db): ?array
{
    $token = $_COOKIE['fightcode_session'] ?? '';
    if (!is_string($token) || $token === '') {
        return null;
    }
    $now = time();
    $db->prepare('DELETE FROM sesiones WHERE expira_en < ?')->execute([$now]);
    $query = $db->prepare('SELECT u.id,u.nombre,u.apellido,u.identificacion,u.correo,u.rol,u.avatar FROM sesiones s JOIN usuarios u ON u.id=s.usuario_id WHERE s.token_hash=? AND s.expira_en>=?');
    $query->execute([hash('sha256', $token), $now]);
    $user = $query->fetch();
    return $user ?: null;
}

function usuarioPublico(array $user): array
{
    return ['id' => (int)$user['id'], 'nombre' => $user['nombre'], 'apellido' => $user['apellido'] ?? '', 'identificacion' => $user['identificacion'] ?? '', 'correo' => $user['correo'], 'rol' => $user['rol'], 'foto' => !empty($user['avatar']) ? '/api/perfil/foto?v=' . rawurlencode((string)$user['avatar']) : null];
}

function registrarAuditoria(PDO $db, ?array $actor, string $action, string $target = '', array $details = []): void
{
    $query = $db->prepare('INSERT INTO bitacora(actor_id,actor_nombre,accion,objetivo,detalles) VALUES(?,?,?,?,?)');
    $query->execute([
        $actor['id'] ?? null,
        $actor['nombre'] ?? 'Sistema',
        $action,
        mb_substr($target, 0, 140),
        json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
}

function crearSesion(PDO $db, int $userId): array
{
    $token = bin2hex(random_bytes(32));
    $lifetime = 60 * 60 * 24 * 30;
    $db->prepare('INSERT INTO sesiones(token_hash,usuario_id,expira_en) VALUES(?,?,?)')
        ->execute([hash('sha256', $token), $userId, time() + $lifetime]);
    $secure = (getenv('FIGHTCODE_SECURE_COOKIE') ?: '0') === '1';
    setcookie('fightcode_session', $token, [
        'expires' => time() + $lifetime,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    return [];
}

function crearCodigoInvitacionMentor(): string
{
    // 12 símbolos de un alfabeto de 32 caracteres sin letras o números ambiguos.
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $random = random_bytes(12);
    $code = '';
    for ($index = 0; $index < 12; $index++) {
        $code .= $alphabet[ord($random[$index]) & 31];
    }
    return $code;
}

function invalidarSesiones(PDO $db, int $userId): void
{
    $db->prepare('DELETE FROM sesiones WHERE usuario_id=?')->execute([$userId]);
}

function exigirMentor(?array $user): array
{
    if (!$user) {
        responder(401, ['error' => 'Inicia sesión como mentor.']);
    }
    if ($user['rol'] !== 'mentor') {
        responder(403, ['error' => 'Esta acción está reservada a mentores.']);
    }
    return $user;
}

function validarModulo(array $data): array
{
    $slug = strtolower(trim((string)($data['slug'] ?? '')));
    $title = trim((string)($data['titulo'] ?? ''));
    $summary = trim((string)($data['resumen'] ?? ''));
    $level = trim((string)($data['nivel'] ?? 'Inicial'));
    $duration = trim((string)($data['duracion'] ?? ''));
    $icon = trim((string)($data['icono'] ?? '</>'));
    $published = !empty($data['publicado']) ? 1 : 0;
    $structure = $data['estructura'] ?? null;
    if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) || strlen($slug) > 90) {
        responder(400, ['error' => 'El identificador debe usar minúsculas, números y guiones.']);
    }
    if ($title === '' || mb_strlen($title) > 120 || mb_strlen($summary) > 1000 || $level === '' || mb_strlen($level) > 40 || mb_strlen($duration) > 80 || $icon === '' || mb_strlen($icon) > 80) {
        responder(400, ['error' => 'Revisa el título, resumen, nivel, duración e icono del módulo.']);
    }
    if (!is_array($structure)) responder(400, ['error' => 'Completa la estructura del módulo.']);

    $lessons = $structure['lecciones'] ?? [];
    $sections = $structure['quiz']['secciones'] ?? [];
    $materials = $structure['materiales'] ?? [];
    $resources = $structure['recursos'] ?? [];
    if (!is_array($lessons) || count($lessons) < 1 || count($lessons) > 40 || !is_array($sections) || count($sections) < 1 || count($sections) > 40 || !is_array($materials) || count($materials) > 50 || !is_array($resources) || count($resources) > 50) {
        responder(400, ['error' => 'Agrega al menos una lección y una sección de quiz; revisa los límites de contenido.']);
    }
    $cleanLessons = [];
    foreach ($lessons as $lesson) {
        if (!is_array($lesson)) responder(400, ['error' => 'Una lección tiene formato incorrecto.']);
        $lessonTitle = trim((string)($lesson['titulo'] ?? ''));
        $description = trim((string)($lesson['descripcion'] ?? ''));
        $concepts = $lesson['conceptos'] ?? [];
        if ($lessonTitle === '' || $description === '' || mb_strlen($lessonTitle) > 140 || mb_strlen($description) > 3000 || !is_array($concepts) || count($concepts) > 30) {
            responder(400, ['error' => 'Cada lección necesita título, descripción y una lista de conceptos.']);
        }
        $cleanLessons[] = ['titulo' => $lessonTitle, 'descripcion' => $description, 'conceptos' => array_values(array_filter(array_map(static fn($v) => mb_substr(trim((string)$v), 0, 180), $concepts)))];
    }

    $cleanSections = [];
    $totalQuestions = 0;
    foreach ($sections as $section) {
        if (!is_array($section)) responder(400, ['error' => 'Una sección del quiz tiene formato incorrecto.']);
        $sectionTitle = trim((string)($section['titulo'] ?? ''));
        $questions = $section['preguntas'] ?? [];
        if ($sectionTitle === '' || mb_strlen($sectionTitle) > 140 || !is_array($questions) || count($questions) < 1 || count($questions) > 100) {
            responder(400, ['error' => 'Cada sección del quiz necesita un título y al menos una pregunta.']);
        }
        $cleanQuestions = [];
        foreach ($questions as $question) {
            if (!is_array($question)) responder(400, ['error' => 'Una pregunta tiene formato incorrecto.']);
            $prompt = trim((string)($question['pregunta'] ?? ''));
            $options = $question['opciones'] ?? [];
            $answer = filter_var($question['correcta'] ?? null, FILTER_VALIDATE_INT);
            $why = trim((string)($question['explicacion'] ?? ''));
            $wrongWhy = trim((string)($question['explicacion_incorrecta'] ?? ''));
            if ($prompt === '' || mb_strlen($prompt) > 2000 || !is_array($options) || count($options) < 2 || count($options) > 8 || $answer === false || $answer < 0 || $answer >= count($options) || $why === '' || $wrongWhy === '') {
                responder(400, ['error' => 'Cada pregunta necesita enunciado, opciones, respuesta correcta y explicaciones.']);
            }
            $cleanOptions = array_map(static fn($v) => mb_substr(trim((string)$v), 0, 500), $options);
            if (in_array('', $cleanOptions, true)) responder(400, ['error' => 'Completa todas las opciones de cada pregunta.']);
            $cleanQuestions[] = ['pregunta' => $prompt, 'opciones' => $cleanOptions, 'correcta' => $answer, 'explicacion' => mb_substr($why, 0, 2000), 'explicacion_incorrecta' => mb_substr($wrongWhy, 0, 2000)];
            $totalQuestions++;
        }
        $cleanSections[] = ['titulo' => $sectionTitle, 'preguntas' => $cleanQuestions];
    }
    if ($totalQuestions > 300) responder(400, ['error' => 'El quiz puede tener hasta 300 preguntas.']);

    $cleanMaterials = [];
    $cleanResources = [];
    foreach (['materiales' => $materials, 'recursos' => $resources] as $groupName => $items) {
        $cleanItems = [];
        foreach ($items as $item) {
            if (!is_array($item)) responder(400, ['error' => 'Un recurso tiene formato incorrecto.']);
            $itemTitle = trim((string)($item['titulo'] ?? ''));
            $description = trim((string)($item['descripcion'] ?? ''));
            $url = trim((string)($item['url'] ?? ''));
            if ($itemTitle === '' || mb_strlen($itemTitle) > 180 || mb_strlen($description) > 3000 || mb_strlen($url) > 1000 || ($url !== '' && (!filter_var($url, FILTER_VALIDATE_URL) || !preg_match('/^https?:\/\//i', $url)))) {
                responder(400, ['error' => 'Revisa el título, descripción y enlace de cada recurso.']);
            }
            $cleanItems[] = ['titulo' => $itemTitle, 'descripcion' => $description, 'url' => $url];
        }
        if ($groupName === 'materiales') $cleanMaterials = $cleanItems;
        else $cleanResources = $cleanItems;
    }
    $reflections = $structure['quiz']['reflexiones'] ?? [];
    if (!is_array($reflections) || count($reflections) !== 2 || trim((string)$reflections[0]) === '' || trim((string)$reflections[1]) === '') {
        responder(400, ['error' => 'Define las dos preguntas abiertas de cierre del quiz.']);
    }
    $cleanStructure = [
        'presentacion' => [
            'titulo' => mb_substr(trim((string)($structure['presentacion']['titulo'] ?? '')), 0, 160),
            'descripcion' => mb_substr(trim((string)($structure['presentacion']['descripcion'] ?? '')), 0, 5000),
            'ejemplo' => mb_substr(trim((string)($structure['presentacion']['ejemplo'] ?? '')), 0, 5000),
        ],
        'lecciones' => $cleanLessons,
        'materiales' => $cleanMaterials,
        'recursos' => $cleanResources,
        'reto' => [
            'descripcion' => mb_substr(trim((string)($structure['reto']['descripcion'] ?? '')), 0, 3000),
            'pdf' => trim((string)($structure['reto']['pdf'] ?? '')),
        ],
        'quiz' => ['secciones' => $cleanSections, 'reflexiones' => array_map(static fn($v) => mb_substr(trim((string)$v), 0, 300), $reflections)],
    ];
    $pdf = $cleanStructure['reto']['pdf'];
    $validPdf = $pdf === '' || (filter_var($pdf, FILTER_VALIDATE_URL) && preg_match('/^https?:\/\//i', $pdf)) || (preg_match('#^/documentos/[a-zA-Z0-9._/-]+\.pdf$#i', $pdf) && !str_contains($pdf, '..'));
    if (mb_strlen($pdf) > 1000 || !$validPdf) {
        responder(400, ['error' => 'El PDF del reto debe ser un enlace http o https válido.']);
    }
    return [$slug, $title, $summary, $level, $duration, $icon, $published, json_encode($cleanStructure, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)];
}

function moduloPublico(array $row, bool $includeAnswers = true): array
{
    $row['id'] = (int)$row['id'];
    $row['publicado'] = (bool)$row['publicado'];
    $row['estructura'] = json_decode((string)$row['estructura'], true, 512, JSON_THROW_ON_ERROR);
    if (!$includeAnswers && isset($row['estructura']['quiz']['secciones']) && is_array($row['estructura']['quiz']['secciones'])) {
        foreach ($row['estructura']['quiz']['secciones'] as &$section) {
            if (isset($section['preguntas']) && is_array($section['preguntas'])) {
                foreach ($section['preguntas'] as &$question) unset($question['correcta']);
                unset($question);
            }
        }
        unset($section);
    }
    unset($row['mentor_id']);
    return $row;
}

function apiGet(PDO $db, string $path, ?array $user): never
{
    if (preg_match('#^/api/modulos/icono/([a-f0-9]{32}\\.(?:jpg|png|webp))$#', $path, $match)) {
        $file = dirname(__DIR__) . '/storage/module-icons/' . $match[1];
        if (!is_file($file)) responder(404, ['error' => 'No se encontró el icono del módulo.']);
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) responder(404, ['error' => 'El icono del módulo no es una imagen válida.']);
        header('Content-Type: ' . $mime);
        header('Cache-Control: public, max-age=31536000, immutable');
        header('X-Content-Type-Options: nosniff');
        header('Content-Length: ' . filesize($file));
        readfile($file);
        exit;
    }
    if ($path === '/api/sesion') {
        responder(200, ['autenticado' => (bool)$user, 'usuario' => $user ? usuarioPublico($user) : null]);
    }
    if ($path === '/api/perfil/foto') {
        if (!$user) responder(401, ['error' => 'Inicia sesión para ver la foto de perfil.']);
        $query = $db->prepare('SELECT avatar FROM usuarios WHERE id=?');
        $query->execute([$user['id']]);
        $avatar = $query->fetchColumn();
        if (!$avatar) responder(404, ['error' => 'No hay foto de perfil.']);
        $file = dirname(__DIR__) . '/storage/avatars/' . basename((string)$avatar);
        if (!is_file($file)) responder(404, ['error' => 'No se encontró la foto de perfil.']);
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) responder(404, ['error' => 'El archivo de perfil no es una imagen válida.']);
        header('Content-Type: ' . $mime);
        header('Cache-Control: private, no-store');
        header('X-Content-Type-Options: nosniff');
        header('Content-Length: ' . filesize($file));
        readfile($file);
        exit;
    }
    if ($path === '/api/contenido') {
        if (!$user) responder(401, ['error' => 'Inicia sesión para ver el contenido.']);
        $rows = $db->query("SELECT * FROM contenido WHERE publicado=1 AND canal='anuncios' ORDER BY actualizado_en DESC")->fetchAll();
        responder(200, ['contenido' => $rows]);
    }
    if ($path === '/api/foro') {
        if (!$user) responder(401, ['error' => 'Inicia sesión para consultar el foro.']);
        $moduleSlug = trim((string)($_GET['modulo'] ?? ''));
        if ($moduleSlug !== '' && !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $moduleSlug)) responder(400, ['error' => 'El módulo indicado no es válido.']);
        $sql = "SELECT c.id,c.titulo,c.tipo,c.canal,c.modulo_slug,c.cuerpo,c.url,c.creado_en,c.actualizado_en,u.nombre autor_nombre,u.apellido autor_apellido,u.rol autor_rol,
            (SELECT COUNT(*) FROM foro_comentarios f WHERE f.contenido_id=c.id) comentarios
            FROM contenido c JOIN usuarios u ON u.id=c.mentor_id WHERE c.publicado=1";
        if ($moduleSlug !== '') {
            $query = $db->prepare($sql . " AND c.canal='comunidad' AND c.modulo_slug=? ORDER BY c.actualizado_en DESC,c.id DESC");
            $query->execute([$moduleSlug]);
            $rows = $query->fetchAll();
        } else {
            $rows = $db->query($sql . ' ORDER BY c.actualizado_en DESC,c.id DESC')->fetchAll();
        }
        responder(200, ['publicaciones' => $rows]);
    }
    if (preg_match('#^/api/foro/(\\d+)/comentarios$#', $path, $match)) {
        if (!$user) responder(401, ['error' => 'Inicia sesión para leer la conversación.']);
        $postId = (int)$match[1];
        $check = $db->prepare("SELECT id FROM contenido WHERE id=? AND publicado=1 AND canal='comunidad'");
        $check->execute([$postId]);
        if (!$check->fetch()) responder(404, ['error' => 'No se encontró esa conversación.']);
        $query = $db->prepare('SELECT f.id,f.cuerpo,f.creado_en,u.nombre autor,u.rol FROM foro_comentarios f JOIN usuarios u ON u.id=f.usuario_id WHERE f.contenido_id=? ORDER BY f.creado_en,f.id');
        $query->execute([$postId]);
        responder(200, ['comentarios' => $query->fetchAll()]);
    }
    if ($path === '/api/resultados') {
        if (!$user) responder(401, ['error' => 'Inicia sesión para consultar tus resultados.']);
        $query = $db->prepare('SELECT id,modulo,correctas,incorrectas,total,porcentaje,reflexion_aprendizaje,reflexion_dificultades,creado_en FROM resultados_quiz WHERE usuario_id=? ORDER BY id DESC');
        $query->execute([$user['id']]);
        responder(200, ['resultados' => $query->fetchAll()]);
    }
    if ($path === '/api/progreso') {
        if (!$user) responder(401, ['error' => 'Inicia sesión para consultar tu progreso.']);
        $query = $db->prepare('SELECT modulo,MAX(porcentaje) mejor_puntaje FROM resultados_quiz WHERE usuario_id=? GROUP BY modulo');
        $query->execute([$user['id']]);
        responder(200, ['progreso' => $query->fetchAll()]);
    }
    if ($path === '/api/reuniones') {
        if (!$user) responder(401, ['error' => 'Inicia sesión para consultar las reuniones.']);
        $rows = $db->query("SELECT r.id,r.titulo,r.descripcion,r.inicia_en,r.termina_en,r.enlace_meet,u.nombre mentor_nombre,u.apellido mentor_apellido
            FROM reuniones r JOIN usuarios u ON u.id=r.mentor_id WHERE r.inicia_en >= NOW() ORDER BY r.inicia_en LIMIT 100")->fetchAll();
        responder(200, ['reuniones' => $rows]);
    }
    if ($path === '/api/pelea/ranking') {
        if (!$user) responder(401, ['error' => 'Inicia sesión para consultar el ranking.']);
        $rows = $db->query('SELECT u.nombre,r.victorias,r.derrotas,r.empates,r.puntos,r.dano_total,r.peleas FROM fight_records r JOIN usuarios u ON u.id=r.usuario_id ORDER BY r.puntos DESC,r.victorias DESC,r.dano_total DESC,r.peleas ASC,u.nombre ASC LIMIT 10')->fetchAll();
        responder(200, ['ranking' => $rows]);
    }
    if ($path === '/api/modulos') {
        if (!$user) responder(401, ['error' => 'Inicia sesión para ver los módulos.']);
        $isMentor = ($user['rol'] ?? '') === 'mentor';
        $query = $isMentor
            ? $db->query('SELECT id,slug,titulo,resumen,nivel,duracion,icono,publicado,estructura,mentor_id,creado_en,actualizado_en FROM modulos ORDER BY actualizado_en DESC')
            : $db->query('SELECT id,slug,titulo,resumen,nivel,duracion,icono,publicado,estructura,mentor_id,creado_en,actualizado_en FROM modulos WHERE publicado=1 ORDER BY actualizado_en DESC');
        $includeAnswers = $isMentor;
        responder(200, ['modulos' => array_map(static fn($row) => moduloPublico($row, $includeAnswers), $query->fetchAll())]);
    }
    if (preg_match('#^/api/modulos/([a-z0-9-]+)$#', $path, $match)) {
        if (!$user) responder(401, ['error' => 'Inicia sesión para ver este módulo.']);
        $query = $db->prepare('SELECT id,slug,titulo,resumen,nivel,duracion,icono,publicado,estructura,mentor_id,creado_en,actualizado_en FROM modulos WHERE slug=?');
        $query->execute([$match[1]]);
        $row = $query->fetch();
        $isMentor = ($user['rol'] ?? '') === 'mentor';
        if (!$row || (!$row['publicado'] && !$isMentor)) responder(404, ['error' => 'No se encontró ese módulo.']);
        responder(200, ['modulo' => moduloPublico($row, $isMentor)]);
    }
    if (str_starts_with($path, '/api/admin/')) {
        exigirMentor($user);
        if ($path === '/api/admin/resumen') {
            $query = $db->prepare("SELECT
                (SELECT COUNT(*) FROM usuarios WHERE rol='coder') coders,
                (SELECT COUNT(*) FROM resultados_quiz) quizzes,
                (SELECT COUNT(*) FROM asistencia WHERE fecha=CURDATE() AND estado='presente') presentes,
                (SELECT COUNT(*) FROM contenido WHERE publicado=1) publicaciones");
            $query->execute();
            responder(200, ['resumen' => $query->fetch()]);
        }
        if ($path === '/api/admin/coders') {
            $rows = $db->query("SELECT u.id,u.nombre,u.correo,u.creado_en,
                (SELECT COUNT(*) FROM resultados_quiz r WHERE r.usuario_id=u.id) quizzes,
                COALESCE((SELECT MAX(r.porcentaje) FROM resultados_quiz r WHERE r.usuario_id=u.id),0) mejor_puntaje,
                COALESCE((SELECT MAX(b.creado_en) FROM bitacora b WHERE b.actor_id=u.id AND b.accion IN ('inicio_sesion','quiz_completado','comentario_foro_creado','pelea_registrada')),u.creado_en) ultima_actividad
                FROM usuarios u WHERE u.rol='coder' ORDER BY u.nombre")->fetchAll();
            responder(200, ['coders' => $rows]);
        }
        if ($path === '/api/admin/progreso-modulos') {
            $rows = $db->query("SELECT r.modulo,COALESCE(m.titulo,IF(r.modulo='python-basico','Python Básico',r.modulo)) titulo,
                COUNT(DISTINCT r.usuario_id) coders_completaron,ROUND(AVG(r.porcentaje)) promedio,
                (SELECT COUNT(*) FROM usuarios WHERE rol='coder') total_coders
                FROM resultados_quiz r LEFT JOIN modulos m ON m.slug=r.modulo
                GROUP BY r.modulo,m.titulo ORDER BY coders_completaron DESC,titulo")->fetchAll();
            responder(200, ['progreso' => $rows]);
        }
        if ($path === '/api/admin/mentores') {
            $rows = $db->query("SELECT id,nombre,apellido,identificacion,correo,creado_en FROM usuarios WHERE rol='mentor' ORDER BY nombre,apellido")->fetchAll();
            responder(200, ['mentores' => $rows]);
        }
        if ($path === '/api/admin/reuniones') {
            $rows = $db->query("SELECT r.id,r.titulo,r.descripcion,r.inicia_en,r.termina_en,r.enlace_meet,u.nombre mentor_nombre,u.apellido mentor_apellido
                FROM reuniones r JOIN usuarios u ON u.id=r.mentor_id ORDER BY r.inicia_en DESC LIMIT 200")->fetchAll();
            responder(200, ['reuniones' => $rows]);
        }
        if ($path === '/api/admin/resultados') {
            $rows = $db->query("SELECT r.*,u.nombre coder_nombre,u.correo coder_correo FROM resultados_quiz r
                JOIN usuarios u ON u.id=r.usuario_id WHERE u.rol='coder' ORDER BY r.id DESC")->fetchAll();
            responder(200, ['resultados' => $rows]);
        }
        if ($path === '/api/admin/asistencia') {
            $rows = $db->query('SELECT a.*,u.nombre coder_nombre,m.nombre mentor_nombre FROM asistencia a
                JOIN usuarios u ON u.id=a.coder_id JOIN usuarios m ON m.id=a.mentor_id ORDER BY a.fecha DESC,a.id DESC LIMIT 500')->fetchAll();
            responder(200, ['asistencias' => $rows]);
        }
        if ($path === '/api/admin/contenido') {
            responder(200, ['contenido' => $db->query('SELECT * FROM contenido ORDER BY actualizado_en DESC')->fetchAll()]);
        }
        if ($path === '/api/admin/modulos') {
            $query = $db->query('SELECT id,slug,titulo,resumen,nivel,duracion,icono,publicado,estructura,mentor_id,creado_en,actualizado_en FROM modulos ORDER BY actualizado_en DESC');
            responder(200, ['modulos' => array_map('moduloPublico', $query->fetchAll())]);
        }
        if ($path === '/api/admin/bitacora') {
            responder(200, [
                'eventos' => $db->query('SELECT * FROM bitacora ORDER BY id DESC LIMIT 500')->fetchAll(),
                'consultado_en' => $db->query('SELECT DATE_FORMAT(NOW(), "%Y-%m-%d %H:%i:%s")')->fetchColumn(),
            ]);
        }
    }
    responder(404, ['error' => 'Ruta API no encontrada.']);
}

function apiPost(PDO $db, string $path, array $data, ?array $user): never
{
    if ($path === '/api/foro') {
        if (!$user) responder(401, ['error' => 'Inicia sesión para abrir una conversación.']);
        if (!in_array($user['rol'], ['coder', 'mentor'], true)) responder(403, ['error' => 'Tu cuenta no puede iniciar conversaciones.']);
        $title = trim((string)($data['titulo'] ?? ''));
        $body = trim((string)($data['cuerpo'] ?? ''));
        $moduleSlug = trim((string)($data['modulo_slug'] ?? ''));
        if ($title === '' || mb_strlen($title) > 140) responder(400, ['error' => 'El título debe tener entre 1 y 140 caracteres.']);
        if ($body === '' || mb_strlen($body) > 3000) responder(400, ['error' => 'La descripción debe tener entre 1 y 3.000 caracteres.']);
        if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $moduleSlug)) responder(400, ['error' => 'El módulo indicado no es válido.']);
        $module = $db->prepare('SELECT titulo FROM modulos WHERE slug=? AND publicado=1');
        $module->execute([$moduleSlug]);
        if (!$module->fetch()) responder(404, ['error' => 'No se encontró un módulo publicado con ese identificador.']);
        $save = $db->prepare("INSERT INTO contenido(titulo,tipo,canal,modulo_slug,cuerpo,url,publicado,mentor_id) VALUES(?,'anuncio','comunidad',?,?,'',1,?)");
        $save->execute([$title, $moduleSlug, $body, $user['id']]);
        $id = (int)$db->lastInsertId();
        registrarAuditoria($db, $user, 'foro_conversacion_creada', 'contenido:' . $id, ['modulo' => $moduleSlug]);
        responder(201, ['guardado' => true, 'id' => $id]);
    }
    if ($path === '/api/admin/modulos/icono') {
        $mentor = exigirMentor($user);
        $upload = $_FILES['icono_imagen'] ?? null;
        if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || ($upload['size'] ?? 0) < 1 || $upload['size'] > 4 * 1024 * 1024) {
            responder(400, ['error' => 'Elige una imagen JPG, PNG o WebP de hasta 4 MB.']);
        }
        $image = @getimagesize($upload['tmp_name']);
        $mime = is_array($image) ? ($image['mime'] ?? '') : '';
        $formats = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!isset($formats[$mime]) || ($image[0] ?? 0) > 4096 || ($image[1] ?? 0) > 4096) {
            responder(400, ['error' => 'Usa una imagen JPG, PNG o WebP válida de máximo 4096 × 4096.']);
        }
        $directory = dirname(__DIR__) . '/storage/module-icons';
        if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) responder(500, ['error' => 'No se pudo preparar el almacenamiento de iconos.']);
        $filename = bin2hex(random_bytes(16)) . '.' . $formats[$mime];
        if (!move_uploaded_file($upload['tmp_name'], $directory . '/' . $filename)) responder(500, ['error' => 'No se pudo guardar la imagen del módulo.']);
        registrarAuditoria($db, $mentor, 'modulo_icono_subido', 'modulo', ['archivo' => $filename]);
        responder(201, ['guardado' => true, 'icono' => '/api/modulos/icono/' . $filename]);
    }
    if (preg_match('#^/api/admin/usuarios/(\d+)/clave-temporal$#', $path, $match)) {
        $mentor = exigirMentor($user);
        $id = (int)$match[1];
        if ($id === (int)$mentor['id']) responder(400, ['error' => 'Usa el apartado de cuenta para cambiar tu propia contraseña.']);

        $db->beginTransaction();
        try {
            $query = $db->prepare('SELECT id,nombre,apellido,correo,rol FROM usuarios WHERE id=? FOR UPDATE');
            $query->execute([$id]);
            $target = $query->fetch();
            if (!$target) {
                $db->rollBack();
                responder(404, ['error' => 'No se encontró esa cuenta.']);
            }
            if (!in_array($target['rol'], ['coder', 'mentor'], true)) {
                $db->rollBack();
                responder(400, ['error' => 'El tipo de cuenta no se puede actualizar desde este panel.']);
            }

            // La contraseña anterior nunca se puede recuperar; se reemplaza por una clave aleatoria y se entrega una sola vez.
            $temporaryPassword = rtrim(strtr(base64_encode(random_bytes(18)), '+/', '-_'), '=');
            $db->prepare('UPDATE usuarios SET hash_clave=? WHERE id=?')->execute([password_hash($temporaryPassword, PASSWORD_DEFAULT), $id]);
            invalidarSesiones($db, $id);
            registrarAuditoria($db, $mentor, 'clave_temporal_generada', 'usuario:' . $id, [
                'nombre' => trim($target['nombre'] . ' ' . ($target['apellido'] ?? '')),
                'correo' => $target['correo'],
                'rol' => $target['rol'],
            ]);
            $db->commit();
        } catch (Throwable $error) {
            if ($db->inTransaction()) $db->rollBack();
            throw $error;
        }

        responder(200, ['generada' => true, 'clave_temporal' => $temporaryPassword]);
    }
    if ($path === '/api/admin/reuniones') {
        $mentor = exigirMentor($user);
        $title = trim((string)($data['titulo'] ?? ''));
        $description = trim((string)($data['descripcion'] ?? ''));
        $start = trim((string)($data['inicia_en'] ?? ''));
        $end = trim((string)($data['termina_en'] ?? ''));
        $meet = trim((string)($data['enlace_meet'] ?? ''));
        $parseDate = static function (string $value): ?DateTimeImmutable {
            $date = DateTimeImmutable::createFromFormat('!Y-m-d\\TH:i', $value, new DateTimeZone('America/Bogota'));
            $errors = DateTimeImmutable::getLastErrors();
            return $date && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0)) && $date->format('Y-m-d\\TH:i') === $value ? $date : null;
        };
        $startDate = $parseDate($start);
        $endDate = $parseDate($end);
        if ($title === '' || mb_strlen($title) > 140 || mb_strlen($description) > 3000) responder(400, ['error' => 'Escribe un título (máximo 140 caracteres) y una descripción de hasta 3.000 caracteres.']);
        if (!$startDate || !$endDate || $startDate <= new DateTimeImmutable('now', new DateTimeZone('America/Bogota')) || $endDate <= $startDate || $endDate->getTimestamp() - $startDate->getTimestamp() > 8 * 3600) responder(400, ['error' => 'Revisa la fecha y hora. La reunión debe ser futura y durar máximo 8 horas.']);
        $meetHost = strtolower((string)(parse_url($meet, PHP_URL_HOST) ?: ''));
        if (!filter_var($meet, FILTER_VALIDATE_URL) || $meetHost !== 'meet.google.com' || strtolower((string)parse_url($meet, PHP_URL_SCHEME)) !== 'https' || mb_strlen($meet) > 1000) responder(400, ['error' => 'Agrega un enlace HTTPS válido de Google Meet.']);
        $save = $db->prepare('INSERT INTO reuniones(titulo,descripcion,inicia_en,termina_en,enlace_meet,mentor_id) VALUES(?,?,?,?,?,?)');
        $save->execute([$title, $description, $startDate->format('Y-m-d H:i:s'), $endDate->format('Y-m-d H:i:s'), $meet, $mentor['id']]);
        $id = (int)$db->lastInsertId();
        registrarAuditoria($db, $mentor, 'reunion_programada', 'reunion:' . $id, ['titulo' => $title, 'inicia_en' => $startDate->format('Y-m-d H:i:s')]);
        responder(201, ['guardado' => true, 'id' => $id]);
    }
    if ($path === '/api/perfil/foto') {
        if (!$user) responder(401, ['error' => 'Inicia sesión para actualizar tu foto.']);
        $upload = $_FILES['foto'] ?? null;
        if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || ($upload['size'] ?? 0) > 4 * 1024 * 1024) {
            responder(400, ['error' => 'Elige una imagen de hasta 4 MB.']);
        }
        $file = (string)($upload['tmp_name'] ?? '');
        $mime = is_uploaded_file($file) ? (new finfo(FILEINFO_MIME_TYPE))->file($file) : false;
        $image = @getimagesize($file);
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!$mime || !isset($allowed[$mime]) || !$image || $image[0] < 1 || $image[1] < 1 || $image[0] > 4096 || $image[1] > 4096 || ($image['mime'] ?? '') !== $mime) {
            responder(400, ['error' => 'Usa una imagen JPG, PNG o WebP válida de máximo 4096 × 4096.']);
        }
        $directory = dirname(__DIR__) . '/storage/avatars';
        if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) responder(500, ['error' => 'No se pudo preparar el almacenamiento de fotos.']);
        $filename = bin2hex(random_bytes(24)) . '.' . $allowed[$mime];
        if (!move_uploaded_file($file, $directory . '/' . $filename)) responder(500, ['error' => 'No se pudo guardar la foto.']);
        $old = $db->prepare('SELECT avatar FROM usuarios WHERE id=?');
        $old->execute([$user['id']]);
        $oldAvatar = $old->fetchColumn();
        $db->prepare('UPDATE usuarios SET avatar=? WHERE id=?')->execute([$filename, $user['id']]);
        if ($oldAvatar) @unlink($directory . '/' . basename((string)$oldAvatar));
        responder(200, ['guardado' => true, 'foto' => '/api/perfil/foto?v=' . rawurlencode($filename)]);
    }
    if ($path === '/api/perfil/foto/eliminar') {
        if (!$user) responder(401, ['error' => 'Inicia sesión para actualizar tu foto.']);
        $query = $db->prepare('SELECT avatar FROM usuarios WHERE id=?');
        $query->execute([$user['id']]);
        $avatar = $query->fetchColumn();
        $db->prepare('UPDATE usuarios SET avatar=NULL WHERE id=?')->execute([$user['id']]);
        if ($avatar) @unlink(dirname(__DIR__) . '/storage/avatars/' . basename((string)$avatar));
        responder(200, ['guardado' => true, 'foto' => null]);
    }
    if (preg_match('#^/api/foro/(\\d+)/comentarios$#', $path, $match)) {
        if (!$user) responder(401, ['error' => 'Inicia sesión para participar en el foro.']);
        $postId = (int)$match[1];
        $check = $db->prepare("SELECT titulo FROM contenido WHERE id=? AND publicado=1 AND canal='comunidad'");
        $check->execute([$postId]);
        if (!$check->fetch()) responder(404, ['error' => 'No se encontró esa conversación.']);
        $body = trim((string)($data['cuerpo'] ?? ''));
        if ($body === '' || mb_strlen($body) > 3000) responder(400, ['error' => 'El comentario debe tener entre 1 y 3.000 caracteres.']);
        $save = $db->prepare('INSERT INTO foro_comentarios(contenido_id,usuario_id,cuerpo) VALUES(?,?,?)');
        $save->execute([$postId, $user['id'], $body]);
        $id = (int)$db->lastInsertId();
        registrarAuditoria($db, $user, 'comentario_foro_creado', 'contenido:' . $postId, ['comentario_id' => $id]);
        responder(201, ['guardado' => true, 'id' => $id]);
    }
    if ($path === '/api/admin/modulos') {
        $mentor = exigirMentor($user);
        [$slug, $title, $summary, $level, $duration, $icon, $published, $structure] = validarModulo($data);
        try {
            $save = $db->prepare('INSERT INTO modulos(slug,titulo,resumen,nivel,duracion,icono,publicado,estructura,mentor_id) VALUES(?,?,?,?,?,?,?,?,?)');
            $save->execute([$slug, $title, $summary, $level, $duration, $icon, $published, $structure, $mentor['id']]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') responder(409, ['error' => 'Ya existe un módulo con ese identificador.']);
            throw $error;
        }
        $id = (int)$db->lastInsertId();
        registrarAuditoria($db, $mentor, 'modulo_creado', 'modulo:' . $id, ['titulo' => $title, 'publicado' => (bool)$published]);
        responder(201, ['guardado' => true, 'id' => $id]);
    }
    if ($path === '/api/admin/invitaciones') {
        $mentor = exigirMentor($user);
        $token = crearCodigoInvitacionMentor();
        $query = $db->prepare('INSERT INTO mentor_invitaciones(token_hash,creado_por,expira_en) VALUES(?,?,DATE_ADD(NOW(), INTERVAL 7 DAY))');
        $query->execute([hash('sha256', $token), $mentor['id']]);
        registrarAuditoria($db, $mentor, 'invitacion_mentor_creada', 'invitacion:' . $db->lastInsertId());
        responder(201, ['invitacion' => $token, 'expira_dias' => 7]);
    }
    if ($path === '/api/registro') {
        $name = trim((string)($data['nombre'] ?? ''));
        $surname = trim((string)($data['apellido'] ?? ''));
        $identification = preg_replace('/[^\p{L}\p{N}.-]/u', '', trim((string)($data['identificacion'] ?? '')));
        $email = mb_strtolower(trim((string)($data['correo'] ?? '')));
        $password = (string)($data['clave'] ?? '');
        $role = (string)($data['rol'] ?? 'coder');
        if (mb_strlen($name) < 2 || mb_strlen($name) > 80) responder(400, ['error' => 'Escribe tu nombre (de 2 a 80 caracteres).']);
        if (mb_strlen($surname) < 2 || mb_strlen($surname) > 80) responder(400, ['error' => 'Escribe tu apellido (de 2 a 80 caracteres).']);
        if (mb_strlen($identification) < 5 || mb_strlen($identification) > 30) responder(400, ['error' => 'Escribe una cédula o tarjeta de identidad válida.']);
        if (mb_strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) responder(400, ['error' => 'Escribe un correo electrónico válido.']);
        if (strlen($password) < 10 || strlen($password) > 128) responder(400, ['error' => 'La contraseña debe tener entre 10 y 128 caracteres.']);
        if (!in_array($role, ['coder', 'mentor'], true)) responder(400, ['error' => 'Elige Coder o Mentor.']);
        $mentorCode = strtoupper(trim(getenv('FIGHTCODE_MENTOR_CODE') ?: ''));
        if ($role === 'mentor') {
            $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
            limitarIntentos($db, hash('sha256', 'mentor:' . $ip), 5);
        }
        $invite = strtoupper(preg_replace('/[\s-]+/u', '', trim((string)($data['codigo_mentor'] ?? ''))));
        $inviteHash = hash('sha256', $invite);
        if ($role === 'mentor') {
            $db->beginTransaction();
            if ($mentorCode !== '' && hash_equals($mentorCode, $invite)) {
                $db->prepare('INSERT IGNORE INTO mentor_invitaciones(token_hash,creado_por,expira_en) VALUES(?,NULL,DATE_ADD(NOW(), INTERVAL 7 DAY))')->execute([$inviteHash]);
            }
            $invitation = $db->prepare('SELECT id,usado_en FROM mentor_invitaciones WHERE token_hash=? AND expira_en>NOW() FOR UPDATE');
            $invitation->execute([$inviteHash]);
            $inviteRow = $invitation->fetch();
            if (!$inviteRow || $inviteRow['usado_en'] !== null) {
                $db->rollBack();
                responder(400, ['error' => 'La invitación de mentor no es válida, ya fue usada o venció.']);
            }
        }
        try {
            $query = $db->prepare('INSERT INTO usuarios(nombre,apellido,identificacion,correo,hash_clave,rol) VALUES(?,?,?,?,?,?)');
            $query->execute([$name, $surname, $identification, $email, password_hash($password, PASSWORD_DEFAULT), $role]);
            if ($role === 'mentor') {
                $db->prepare('UPDATE mentor_invitaciones SET usado_en=NOW() WHERE id=?')->execute([$inviteRow['id']]);
                $db->commit();
            }
        } catch (PDOException $error) {
            if ($db->inTransaction()) $db->rollBack();
            if ($error->getCode() === '23000') responder(409, ['error' => 'Ya existe una cuenta con ese correo o identificación.']);
            throw $error;
        }
        $id = (int)$db->lastInsertId();
        $account = ['id' => $id, 'nombre' => $name, 'apellido' => $surname, 'identificacion' => $identification, 'correo' => $email, 'rol' => $role];
        registrarAuditoria($db, $account, 'cuenta_creada', 'usuario', ['rol' => $role]);
        crearSesion($db, $id);
        responder(201, ['autenticado' => true, 'usuario' => usuarioPublico($account)]);
    }
    if ($path === '/api/iniciar-sesion') {
        $email = mb_strtolower(trim((string)($data['correo'] ?? '')));
        $password = (string)($data['clave'] ?? '');
        $role = (string)($data['rol'] ?? 'coder');
        $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
        // El límite se asocia al correo y la IP juntos: una IP compartida
        // no debe bloquear los inicios de sesión de todas las demás cuentas.
        limitarIntentos($db, hash('sha256', 'login:' . $ip . ':' . $email));
        $query = $db->prepare('SELECT id,nombre,apellido,identificacion,correo,hash_clave,rol,avatar FROM usuarios WHERE correo=?');
        $query->execute([$email]);
        $account = $query->fetch();
        if (!$account || !password_verify($password, $account['hash_clave']) || $role !== $account['rol']) {
            registrarAuditoria($db, null, 'inicio_sesion_fallido', 'correo', ['correo' => mb_substr($email, 0, 254), 'rol_elegido' => $role]);
            responder(401, ['error' => 'Correo, contraseña o tipo de cuenta incorrectos.']);
        }
        registrarAuditoria($db, $account, 'inicio_sesion', 'sesion');
        $db->prepare('DELETE FROM acceso_intentos WHERE fingerprint=?')->execute([hash('sha256', 'login:' . $ip . ':' . $email)]);
        crearSesion($db, (int)$account['id']);
        responder(200, ['autenticado' => true, 'usuario' => usuarioPublico($account)]);
    }
    if ($path === '/api/cerrar-sesion') {
        if (isset($_COOKIE['fightcode_session'])) {
            $db->prepare('DELETE FROM sesiones WHERE token_hash=?')->execute([hash('sha256', (string)$_COOKIE['fightcode_session'])]);
            registrarAuditoria($db, $user, 'cierre_sesion', 'sesion');
        }
        $secure = (getenv('FIGHTCODE_SECURE_COOKIE') ?: '0') === '1';
        setcookie('fightcode_session', '', ['expires' => time() - 3600, 'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax']);
        responder(200, ['autenticado' => false]);
    }
    if ($path === '/api/resultados') {
        if (!$user) responder(401, ['error' => 'Inicia sesión para guardar tu resultado.']);
        if ($user['rol'] !== 'coder') responder(403, ['error' => 'Solo las cuentas coder pueden guardar resultados de aprendizaje.']);
        $module = (string)($data['modulo'] ?? 'python-basico');
        if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $module) || strlen($module) > 80) responder(400, ['error' => 'El módulo no es válido.']);
        $quizQuery = $db->prepare('SELECT estructura FROM modulos WHERE slug=? AND publicado=1');
        $quizQuery->execute([$module]);
        $quizStructure = $quizQuery->fetchColumn();
        if ($quizStructure) {
            $quizData = json_decode((string)$quizStructure, true);
            $answerKey = [];
            foreach (($quizData['quiz']['secciones'] ?? []) as $section) {
                foreach (($section['preguntas'] ?? []) as $question) $answerKey[] = (int)$question['correcta'];
            }
        } elseif ($module === 'python-basico') {
            $answerKey = [0,1,2,0,0, 1,2,0,2,0, 0,1,1,2,0, 0,2,0,0,1, 2,0,0,0,0];
        } else {
            responder(400, ['error' => 'No se encontró un quiz publicado para este módulo.']);
        }
        $answers = $data['respuestas'] ?? null;
        if (!is_array($answers) || !array_is_list($answers) || count($answers) !== count($answerKey) || count($answerKey) < 1 || count($answerKey) > 300) responder(400, ['error' => 'Las respuestas enviadas no coinciden con el quiz.']);
        $correct = 0;
        foreach ($answerKey as $index => $answer) {
            $selected = filter_var($answers[$index] ?? null, FILTER_VALIDATE_INT);
            if ($selected === false || $selected < 0 || $selected > 7) responder(400, ['error' => 'Una respuesta enviada no es válida.']);
            if ($selected === $answer) $correct++;
        }
        $total = count($answerKey);
        $incorrect = $total - $correct;
        $percent = (int)round($correct / $total * 100);
        $learned = mb_substr((string)($data['aprendizaje'] ?? ''), 0, 5000);
        $difficulties = mb_substr((string)($data['dificultades'] ?? ''), 0, 5000);
        $query = $db->prepare('INSERT INTO resultados_quiz(usuario_id,modulo,correctas,incorrectas,total,porcentaje,reflexion_aprendizaje,reflexion_dificultades) VALUES(?,?,?,?,?,?,?,?)');
        $query->execute([$user['id'], $module, $correct, $incorrect, $total, $percent, $learned, $difficulties]);
        $resultId = (int)$db->lastInsertId();
        registrarAuditoria($db, $user, 'quiz_completado', $module, ['correctas' => $correct, 'incorrectas' => $incorrect, 'porcentaje' => $percent]);
        responder(201, ['guardado' => true, 'id' => $resultId, 'correctas' => $correct, 'incorrectas' => $incorrect, 'total' => $total, 'porcentaje' => $percent]);
    }
    if ($path === '/api/pelea/resultado') {
        if (!$user) responder(401, ['error' => 'Inicia sesión para registrar tu pelea.']);
        $outcome = (string)($data['resultado'] ?? '');
        $method = (string)($data['metodo'] ?? '');
        $damage = filter_var($data['dano'] ?? null, FILTER_VALIDATE_INT);
        if (!in_array($outcome, ['victoria','derrota','empate'], true) || !in_array($method, ['ko','decision','empate'], true) || $damage === false || $damage < 0 || $damage > 1000 || (($outcome === 'empate') !== ($method === 'empate'))) {
            responder(400, ['error' => 'El resultado de la pelea no es válido.']);
        }
        $wins = $outcome === 'victoria' ? 1 : 0;
        $losses = $outcome === 'derrota' ? 1 : 0;
        $draws = $outcome === 'empate' ? 1 : 0;
        $points = $wins * 3 + $draws;
        $save = $db->prepare('INSERT INTO fight_records(usuario_id,victorias,derrotas,empates,puntos,dano_total,peleas) VALUES(?,?,?,?,?,?,1) ON DUPLICATE KEY UPDATE victorias=victorias+VALUES(victorias),derrotas=derrotas+VALUES(derrotas),empates=empates+VALUES(empates),puntos=puntos+VALUES(puntos),dano_total=dano_total+VALUES(dano_total),peleas=peleas+1');
        $save->execute([$user['id'],$wins,$losses,$draws,$points,$damage]);
        $query = $db->prepare('SELECT victorias,derrotas,empates,puntos,dano_total,peleas FROM fight_records WHERE usuario_id=?');
        $query->execute([$user['id']]);
        $record = $query->fetch();
        registrarAuditoria($db, $user, 'pelea_registrada', 'fight-code', ['resultado' => $outcome, 'metodo' => $method, 'dano' => $damage]);
        responder(201, ['guardado' => true, 'registro' => $record]);
    }
    if ($path === '/api/admin/asistencia') {
        $mentor = exigirMentor($user);
        $coderId = filter_var($data['coder_id'] ?? null, FILTER_VALIDATE_INT);
        $day = (string)($data['fecha'] ?? '');
        $state = (string)($data['estado'] ?? '');
        $note = trim((string)($data['nota'] ?? ''));
        $parsedDate = DateTimeImmutable::createFromFormat('!Y-m-d', $day);
        if (!$coderId || !$parsedDate || $parsedDate->format('Y-m-d') !== $day || !in_array($state, ['presente','ausente','tarde','justificada'], true) || mb_strlen($note) > 1000) {
            responder(400, ['error' => 'Revisa el coder, la fecha y el estado de asistencia.']);
        }
        $coderQuery = $db->prepare("SELECT id FROM usuarios WHERE id=? AND rol='coder'");
        $coderQuery->execute([$coderId]);
        if (!$coderQuery->fetch()) responder(400, ['error' => 'El usuario elegido no es un coder.']);
        $check = $db->prepare('SELECT id FROM asistencia WHERE coder_id=? AND fecha=?');
        $check->execute([$coderId, $day]);
        $existing = $check->fetchColumn();
        $save = $db->prepare('INSERT INTO asistencia(coder_id,fecha,estado,nota,mentor_id) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE estado=VALUES(estado),nota=VALUES(nota),mentor_id=VALUES(mentor_id)');
        $save->execute([$coderId, $day, $state, $note, $mentor['id']]);
        $check->execute([$coderId, $day]);
        $attendanceId = (int)$check->fetchColumn();
        registrarAuditoria($db, $mentor, $existing ? 'asistencia_actualizada' : 'asistencia_registrada', 'asistencia:' . $attendanceId,
            ['coder_id' => $coderId, 'fecha' => $day, 'estado' => $state, 'nota' => $note]);
        responder(200, ['guardado' => true, 'id' => $attendanceId]);
    }
    if ($path === '/api/admin/asistencia/lote') {
        $mentor = exigirMentor($user);
        $day = (string)($data['fecha'] ?? '');
        $parsedDate = DateTimeImmutable::createFromFormat('!Y-m-d', $day);
        if (!$parsedDate || $parsedDate->format('Y-m-d') !== $day) responder(400, ['error' => 'Elige una fecha válida para la asistencia.']);
        $coders = $db->query("SELECT id FROM usuarios WHERE rol='coder'")->fetchAll(PDO::FETCH_COLUMN);
        if (!$coders) responder(400, ['error' => 'No hay coders registrados para marcar.']);
        $save = $db->prepare("INSERT INTO asistencia(coder_id,fecha,estado,nota,mentor_id) VALUES(?,?,'presente','',?) ON DUPLICATE KEY UPDATE estado='presente',nota='',mentor_id=VALUES(mentor_id)");
        $db->beginTransaction();
        try {
            foreach ($coders as $coderId) $save->execute([(int)$coderId, $day, $mentor['id']]);
            $db->commit();
        } catch (Throwable $error) {
            if ($db->inTransaction()) $db->rollBack();
            throw $error;
        }
        registrarAuditoria($db, $mentor, 'asistencia_lote_registrada', $day, ['coders' => count($coders), 'fecha' => $day]);
        responder(200, ['guardado' => true, 'cantidad' => count($coders)]);
    }
    if ($path === '/api/admin/contenido') {
        $mentor = exigirMentor($user);
        $values = validarContenido($db, $data);
        $save = $db->prepare('INSERT INTO contenido(titulo,tipo,canal,cuerpo,url,publicado,modulo_slug,mentor_id) VALUES(?,?,?,?,?,?,?,?)');
        $save->execute([...$values, $mentor['id']]);
        $id = (int)$db->lastInsertId();
        registrarAuditoria($db, $mentor, 'contenido_creado', 'contenido:' . $id, ['titulo' => $values[0], 'canal' => $values[2], 'publicado' => (bool)$values[5]]);
        responder(201, ['guardado' => true, 'id' => $id]);
    }
    responder(404, ['error' => 'Ruta API no encontrada.']);
}

function validarContenido(PDO $db, array $data): array
{
    $title = trim((string)($data['titulo'] ?? ''));
    $type = (string)($data['tipo'] ?? 'anuncio');
    $channel = (string)($data['canal'] ?? 'anuncios');
    $body = trim((string)($data['cuerpo'] ?? ''));
    $url = trim((string)($data['url'] ?? ''));
    $published = !empty($data['publicado']) ? 1 : 0;
    $moduleSlug = trim((string)($data['modulo_slug'] ?? ''));
    if ($title === '' || mb_strlen($title) > 140 || mb_strlen($body) > 10000) responder(400, ['error' => 'El título es obligatorio (máx. 140) y el texto no puede superar 10.000 caracteres.']);
    if (!in_array($type, ['anuncio','material','enlace'], true)) responder(400, ['error' => 'Elige anuncio, material o enlace.']);
    if (!in_array($channel, ['anuncios','comunidad'], true)) responder(400, ['error' => 'Elige Anuncios o Comunidad.']);
    if ($url !== '' && (mb_strlen($url) > 1000 || !filter_var($url, FILTER_VALIDATE_URL) || !preg_match('/^https?:\/\//i', $url))) responder(400, ['error' => 'Los enlaces deben comenzar con http:// o https://.']);
    if ($moduleSlug !== '') {
        if ($channel !== 'comunidad') responder(400, ['error' => 'Solo las conversaciones de Comunidad se pueden vincular a un módulo.']);
        if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $moduleSlug) || strlen($moduleSlug) > 90) responder(400, ['error' => 'El identificador del módulo no es válido.']);
        if ($moduleSlug !== 'python-basico') {
            $moduleCheck = $db->prepare('SELECT 1 FROM modulos WHERE slug=?');
            $moduleCheck->execute([$moduleSlug]);
            if (!$moduleCheck->fetchColumn()) responder(400, ['error' => 'Selecciona un módulo existente.']);
        }
    }
    return [$title, $type, $channel, $body, $url, $published, $moduleSlug !== '' ? $moduleSlug : null];
}

function apiPut(PDO $db, string $path, array $data, ?array $user): never
{
    if ($path === '/api/perfil') {
        if (!$user) responder(401, ['error' => 'Inicia sesión para editar tu perfil.']);
        $name = trim((string)($data['nombre'] ?? ''));
        $surname = trim((string)($data['apellido'] ?? ''));
        $identification = preg_replace('/[^\p{L}\p{N}.-]/u', '', trim((string)($data['identificacion'] ?? '')));
        $email = mb_strtolower(trim((string)($data['correo'] ?? '')));
        $password = (string)($data['clave'] ?? '');
        $currentPassword = (string)($data['clave_actual'] ?? '');
        if (mb_strlen($name) < 2 || mb_strlen($name) > 80 || mb_strlen($surname) < 2 || mb_strlen($surname) > 80) responder(400, ['error' => 'Nombre y apellido deben tener entre 2 y 80 caracteres.']);
        if (mb_strlen($identification) < 5 || mb_strlen($identification) > 30) responder(400, ['error' => 'Escribe una identificación válida.']);
        if (mb_strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) responder(400, ['error' => 'Escribe un correo electrónico válido.']);
        if ($password !== '' && (strlen($password) < 10 || strlen($password) > 128)) responder(400, ['error' => 'La nueva contraseña debe tener entre 10 y 128 caracteres.']);
        $current = $db->prepare('SELECT hash_clave FROM usuarios WHERE id=?');
        $current->execute([$user['id']]);
        if (!password_verify($currentPassword, (string)$current->fetchColumn())) responder(403, ['error' => 'La contraseña actual no es correcta.']);
        try {
            if ($password === '') {
                $save = $db->prepare('UPDATE usuarios SET nombre=?,apellido=?,identificacion=?,correo=? WHERE id=?');
                $save->execute([$name, $surname, $identification, $email, $user['id']]);
            } else {
                $save = $db->prepare('UPDATE usuarios SET nombre=?,apellido=?,identificacion=?,correo=?,hash_clave=? WHERE id=?');
                $save->execute([$name, $surname, $identification, $email, password_hash($password, PASSWORD_DEFAULT), $user['id']]);
            }
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') responder(409, ['error' => 'Ese correo o identificación ya está asociado a otra cuenta.']);
            throw $error;
        }
        if ($password !== '') {
            invalidarSesiones($db, (int)$user['id']);
            crearSesion($db, (int)$user['id']);
        }
        $updated = ['id' => $user['id'], 'nombre' => $name, 'apellido' => $surname, 'identificacion' => $identification, 'correo' => $email, 'rol' => $user['rol'], 'avatar' => $user['avatar'] ?? null];
        registrarAuditoria($db, $user, 'perfil_editado', 'usuario', ['cambio_clave' => $password !== '']);
        responder(200, ['guardado' => true, 'usuario' => usuarioPublico($updated)]);
    }
    if (preg_match('#^/api/admin/modulos/(\d+)$#', $path, $match)) {
        $mentor = exigirMentor($user);
        [$slug, $title, $summary, $level, $duration, $icon, $published, $structure] = validarModulo($data);
        $id = (int)$match[1];
        $check = $db->prepare('SELECT id,slug FROM modulos WHERE id=?');
        $check->execute([$id]);
        $existingModule = $check->fetch();
        if (!$existingModule) responder(404, ['error' => 'No se encontró ese módulo.']);
        try {
            $save = $db->prepare('UPDATE modulos SET slug=?,titulo=?,resumen=?,nivel=?,duracion=?,icono=?,publicado=?,estructura=?,mentor_id=?,actualizado_en=NOW() WHERE id=?');
            $save->execute([$slug, $title, $summary, $level, $duration, $icon, $published, $structure, $mentor['id'], $id]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') responder(409, ['error' => 'Ya existe un módulo con ese identificador.']);
            throw $error;
        }
        if ($existingModule['slug'] !== $slug) {
            $db->prepare('UPDATE contenido SET modulo_slug=? WHERE modulo_slug=?')->execute([$slug, $existingModule['slug']]);
        }
        registrarAuditoria($db, $mentor, 'modulo_editado', 'modulo:' . $id, ['titulo' => $title, 'publicado' => (bool)$published]);
        responder(200, ['guardado' => true]);
    }
    if (!preg_match('#^/api/admin/contenido/(\d+)$#', $path, $match)) responder(404, ['error' => 'Ruta API no encontrada.']);
    $mentor = exigirMentor($user);
    $values = validarContenido($db, $data);
    $id = (int)$match[1];
    $check = $db->prepare('SELECT id FROM contenido WHERE id=?');
    $check->execute([$id]);
    if (!$check->fetch()) responder(404, ['error' => 'No se encontró ese contenido.']);
    $save = $db->prepare("UPDATE contenido SET titulo=?,tipo=?,canal=?,cuerpo=?,url=?,publicado=?,modulo_slug=?,mentor_id=?,actualizado_en=NOW() WHERE id=?");
    $save->execute([...$values, $mentor['id'], $id]);
    registrarAuditoria($db, $mentor, 'contenido_editado', 'contenido:' . $id, ['titulo' => $values[0], 'canal' => $values[2], 'publicado' => (bool)$values[5]]);
    responder(200, ['guardado' => true]);
}

function apiDelete(PDO $db, string $path, ?array $user): never
{
    if (preg_match('#^/api/admin/usuarios/(\d+)$#', $path, $match)) {
        $mentor = exigirMentor($user);
        $id = (int)$match[1];
        if ($id === (int)$mentor['id']) responder(400, ['error' => 'No puedes eliminar tu propia cuenta desde este panel.']);

        $db->beginTransaction();
        try {
            $query = $db->prepare('SELECT id,nombre,apellido,correo,rol FROM usuarios WHERE id=? FOR UPDATE');
            $query->execute([$id]);
            $target = $query->fetch();
            if (!$target) {
                $db->rollBack();
                responder(404, ['error' => 'No se encontró esa cuenta.']);
            }
            if (!in_array($target['rol'], ['coder', 'mentor'], true)) {
                $db->rollBack();
                responder(400, ['error' => 'El tipo de cuenta no se puede eliminar desde este panel.']);
            }

            if ($target['rol'] === 'mentor') {
                $mentors = $db->query("SELECT id FROM usuarios WHERE rol='mentor' FOR UPDATE")->fetchAll();
                if (count($mentors) <= 1) {
                    $db->rollBack();
                    responder(409, ['error' => 'No puedes eliminar al último maestro registrado.']);
                }
                // Conserva módulos, publicaciones, reuniones y asistencias al reasignarlos al mentor que ejecuta la acción.
                foreach (['contenido', 'modulos', 'reuniones'] as $table) {
                    $db->prepare("UPDATE {$table} SET mentor_id=? WHERE mentor_id=?")->execute([$mentor['id'], $id]);
                }
                $db->prepare('UPDATE asistencia SET mentor_id=? WHERE mentor_id=?')->execute([$mentor['id'], $id]);
            }

            registrarAuditoria($db, $mentor, 'usuario_eliminado', 'usuario:' . $id, [
                'nombre' => trim($target['nombre'] . ' ' . ($target['apellido'] ?? '')),
                'correo' => $target['correo'],
                'rol' => $target['rol'],
            ]);
            $db->prepare('DELETE FROM usuarios WHERE id=?')->execute([$id]);
            $db->commit();
        } catch (Throwable $error) {
            if ($db->inTransaction()) $db->rollBack();
            throw $error;
        }

        responder(200, ['eliminado' => true, 'rol' => $target['rol']]);
    }
    if (preg_match('#^/api/admin/modulos/(\d+)$#', $path, $match)) {
        $mentor = exigirMentor($user);
        $id = (int)$match[1];
        $query = $db->prepare('SELECT titulo,slug FROM modulos WHERE id=?');
        $query->execute([$id]);
        $row = $query->fetch();
        if (!$row) responder(404, ['error' => 'No se encontró ese módulo.']);
        registrarAuditoria($db, $mentor, 'modulo_eliminado', 'modulo:' . $id, ['titulo' => $row['titulo']]);
        $db->prepare('DELETE FROM contenido WHERE modulo_slug=?')->execute([$row['slug']]);
        $db->prepare('DELETE FROM modulos WHERE id=?')->execute([$id]);
        responder(200, ['eliminado' => true]);
    }
    if (!preg_match('#^/api/admin/contenido/(\d+)$#', $path, $match)) responder(404, ['error' => 'Ruta API no encontrada.']);
    $mentor = exigirMentor($user);
    $id = (int)$match[1];
    $query = $db->prepare('SELECT titulo FROM contenido WHERE id=?');
    $query->execute([$id]);
    $item = $query->fetch();
    if (!$item) responder(404, ['error' => 'No se encontró ese contenido.']);
    registrarAuditoria($db, $mentor, 'contenido_eliminado', 'contenido:' . $id, ['titulo' => $item['titulo']]);
    $db->prepare('DELETE FROM contenido WHERE id=?')->execute([$id]);
    responder(200, ['eliminado' => true]);
}

function ejecutarApi(): never
{
    try {
        $db = conectarBaseDatos();
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if (in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
            validarOrigenMutacion();
            if (!in_array($path, ['/api/registro', '/api/iniciar-sesion', '/api/cerrar-sesion'], true)) {
                $fetchSite = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
                if ($fetchSite === 'cross-site') responder(403, ['error' => 'Solicitud de otro sitio bloqueada.']);
            }
        }
        $user = usuarioActual($db);
        if ($method === 'GET') apiGet($db, $path, $user);
        if ($method === 'POST') apiPost($db, $path, in_array($path, ['/api/perfil/foto', '/api/admin/modulos/icono'], true) ? [] : leerJson(), $user);
        if ($method === 'PUT') apiPut($db, $path, leerJson(), $user);
        if ($method === 'DELETE') apiDelete($db, $path, $user);
        responder(405, ['error' => 'Método no permitido.']);
    } catch (Throwable $error) {
        error_log('FIGHTCODE API: ' . $error->getMessage());
        responder(503, ['error' => 'No se pudo conectar con la base de datos. Revisa la configuración del servidor.']);
    }
}

ejecutarApi();
