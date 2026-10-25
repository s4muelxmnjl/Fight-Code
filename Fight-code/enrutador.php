<?php
declare(strict_types=1);

define('FIGHTCODE_RAIZ', __DIR__);
$uri = (string)($_SERVER['REQUEST_URI'] ?? '/');
$path = parse_url($uri, PHP_URL_PATH) ?: '/';
$parts = [];
foreach (explode('/', rawurldecode($path)) as $part) {
    if ($part === '' || $part === '.') continue;
    if ($part === '..') { array_pop($parts); continue; }
    $parts[] = $part;
}
$path = '/' . implode('/', $parts);
if ($path === '/') $path = '/index.html';

if ($path === '/api' || str_starts_with($path, '/api/')) {
    require FIGHTCODE_RAIZ . '/api/index.php';
    exit;
}

$private = ['/base_datos', '/config', '/storage', '/.git', '/.agents', '/.aws', '/.codex', '/__pycache__', '/.env'];
foreach ($private as $prefix) {
    if ($path === $prefix || str_starts_with($path, $prefix . '/')) {
        http_response_code(404);
        exit('No encontrado.');
    }
}
if ($path === '/enrutador.php' || $path === '/api/index.php') {
    http_response_code(404);
    exit('No encontrado.');
}

$publicAccount = $path === '/paginas/cuenta.html';
$publicAsset = str_starts_with($path, '/styles/') || str_starts_with($path, '/img/') || in_array($path, ['/scripts/sitio.js', '/scripts/cuenta.js'], true);
$requiresLogin = !$publicAccount && !$publicAsset;
$cookie = $_COOKIE['fightcode_session'] ?? '';
$usuario = null;
if ($requiresLogin && is_string($cookie) && $cookie !== '') {
    try {
        require_once FIGHTCODE_RAIZ . '/config/base_datos.php';
        $db = conectarBaseDatos();
        $db->prepare('DELETE FROM sesiones WHERE expira_en < ?')->execute([time()]);
        $query = $db->prepare('SELECT u.id,u.nombre,u.correo,u.rol FROM sesiones s JOIN usuarios u ON u.id=s.usuario_id WHERE s.token_hash=? AND s.expira_en>=?');
        $query->execute([hash('sha256', $cookie), time()]);
        $usuario = $query->fetch() ?: null;
    } catch (Throwable $error) {
        error_log('FIGHTCODE router: ' . $error->getMessage());
        http_response_code(503);
        exit('El sitio requiere la base de datos configurada. Revisa README.md.');
    }
}

if ($requiresLogin && !$usuario) {
    header('Location: /paginas/cuenta.html?next=' . rawurlencode($uri), true, 302);
    exit;
}
if ($path === '/paginas/administracion.html' && ($usuario['rol'] ?? '') !== 'mentor') {
    header('Location: /paginas/ruta_aprendizaje.html', true, 302);
    exit;
}

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}

$root = realpath(FIGHTCODE_RAIZ);
$file = realpath(FIGHTCODE_RAIZ . $path);
if ($file === false || !str_starts_with($file, $root . DIRECTORY_SEPARATOR) || !is_file($file)) {
    http_response_code(404);
    exit('No encontrado.');
}

return false;
