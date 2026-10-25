<?php
declare(strict_types=1);

require_once __DIR__ . '/entorno.php';

function conectarBaseDatos(): PDO
{
    static $conexion = null;
    if ($conexion instanceof PDO) {
        return $conexion;
    }

    $host = getenv('FIGHTCODE_DB_HOST') ?: '127.0.0.1';
    $puerto = getenv('FIGHTCODE_DB_PORT') ?: '3306';
    $nombre = getenv('FIGHTCODE_DB_NAME') ?: 'fightcode';
    $usuario = getenv('FIGHTCODE_DB_USER');
    $clave = getenv('FIGHTCODE_DB_PASSWORD');
    if ($usuario === false || $usuario === '' || $clave === false) {
        throw new RuntimeException('Configura FIGHTCODE_DB_USER y FIGHTCODE_DB_PASSWORD.');
    }
    $dsn = "mysql:host={$host};port={$puerto};dbname={$nombre};charset=utf8mb4";

    $conexion = new PDO($dsn, $usuario, $clave, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $conexion;
}
