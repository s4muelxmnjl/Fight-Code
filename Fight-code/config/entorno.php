<?php
declare(strict_types=1);

/** Carga variables locales sin depender de una biblioteca externa. */
function cargarEntornoLocal(): void
{
    static $cargado = false;
    if ($cargado) {
        return;
    }
    $cargado = true;
    $archivo = dirname(__DIR__) . '/.env';
    if (!is_file($archivo) || !is_readable($archivo)) {
        return;
    }
    foreach (file($archivo, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $linea) {
        $linea = trim($linea);
        if ($linea === '' || str_starts_with($linea, '#') || !str_contains($linea, '=')) {
            continue;
        }
        [$clave, $valor] = explode('=', $linea, 2);
        $clave = trim($clave);
        $valor = trim($valor);
        if ($clave !== '' && getenv($clave) === false) {
            putenv($clave . '=' . $valor);
            $_ENV[$clave] = $valor;
        }
    }
}

cargarEntornoLocal();
