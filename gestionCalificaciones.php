<?php
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');

// Configuración de la base de datos
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "librocalif";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    error_log('Conexión fallida: ' . $conn->connect_error);
    respond(false, 'Error de conexión a la base de datos');
    exit();
}

$conn->set_charset('utf8mb4');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
if (!$action) {
    respond(false, 'Acción no especificada');
    exit();
}

if ($action === 'guardar') {
    $idLibro = filter_input(INPUT_POST, 'idLibro', FILTER_VALIDATE_INT);
    $calificacion = filter_input(INPUT_POST, 'calificacion', FILTER_VALIDATE_INT);
    $resena = filter_input(INPUT_POST, 'resena', FILTER_SANITIZE_STRING);

    // Validaciones
    if (!$idLibro || $calificacion === false || !$resena) {
        respond(false, 'Todos los campos obligatorios son requeridos');
        exit();
    }
    if ($calificacion < 0 || $calificacion > 10) {
        respond(false, 'La calificación debe estar entre 0 y 10');
        exit();
    }
    if (strlen($resena) > 1000) {
        respond(false, 'La reseña no debe exceder 1000 caracteres');
        exit();
    }
    if (!libroExists($conn, $idLibro)) {
        respond(false, 'El ID del libro no existe');
        exit();
    }

    $conn->begin_transaction();
    try {
        // Insertar calificación
        $sql = "INSERT INTO calificaciones (idLibro, calificacion, resena) VALUES (?, ?, ?)";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception('Error al preparar la consulta de calificación: ' . $conn->error);
        }
        $stmt->bind_param("iis", $idLibro, $calificacion, $resena);
        if (!$stmt->execute()) {
            throw new Exception('Error al guardar calificación: ' . $conn->error);
        }
        $idCalificacion = $conn->insert_id;
        $stmt->close();

        // Crear notificación
        $libroInfo = obtenerLibroInfo($conn, $idLibro);
        crearNotificacionCalificacion($conn, $idLibro, $libroInfo['titulo'], $calificacion, $resena);

        $conn->commit();
        respond(true, 'Calificación guardada exitosamente');
    } catch (Exception $e) {
        $conn->rollback();
        error_log('Error en transacción: ' . $e->getMessage());
        respond(false, 'Error al guardar: ' . $e->getMessage());
    }
} elseif ($action === 'lista_libros') {
    $sql = "SELECT idLibro, titulo FROM libros ORDER BY titulo ASC";
    $result = $conn->query($sql);
    $libros = [];
    if ($result && $result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $libros[] = [
                'idLibro' => (int)$row['idLibro'],
                'titulo' => htmlspecialchars($row['titulo'], ENT_QUOTES, 'UTF-8')
            ];
        }
    }
    respond(true, 'Lista de libros recuperada', ['libros' => $libros]);
} elseif ($action === 'lista') {
    $sql = "SELECT c.idCalificacion, c.idLibro, l.titulo, c.calificacion, c.resena 
            FROM calificaciones c 
            JOIN libros l ON c.idLibro = l.idLibro";
    $result = $conn->query($sql);
    $calificaciones = [];
    if ($result && $result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $calificaciones[] = [
                'idCalificacion' => (int)$row['idCalificacion'],
                'idLibro' => (int)$row['idLibro'],
                'titulo' => htmlspecialchars($row['titulo'], ENT_QUOTES, 'UTF-8'),
                'calificacion' => (int)$row['calificacion'],
                'resena' => htmlspecialchars($row['resena'], ENT_QUOTES, 'UTF-8')
            ];
        }
    }
    respond(true, 'Lista de calificaciones recuperada', ['calificaciones' => $calificaciones]);
} elseif ($action === 'guardar_token') {
    $input = json_decode(file_get_contents('php://input'), true);
    $token = $input['token'] ?? '';
    
    if (empty($token)) {
        respond(false, 'Token vacío');
        exit();
    }
    
    guardarTokenFCM($conn, $token);
} else {
    respond(false, 'Acción no válida');
}

$conn->close();

function respond($success, $message, $data = []) {
    $response = ['success' => $success, 'message' => $message];
    if ($data) {
        $response = array_merge($response, $data);
    }
    echo json_encode($response);
}

function libroExists($conn, $idLibro) {
    $sql = "SELECT idLibro FROM libros WHERE idLibro = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $idLibro);
    $stmt->execute();
    $result = $stmt->get_result();
    $exists = $result->num_rows > 0;
    $stmt->close();
    return $exists;
}

function obtenerLibroInfo($conn, $idLibro) {
    $sql = "SELECT titulo FROM libros WHERE idLibro = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $idLibro);
    $stmt->execute();
    $result = $stmt->get_result();
    $libro = $result->num_rows > 0 ? $result->fetch_assoc() : ['titulo' => 'Libro Desconocido'];
    $stmt->close();
    return [
        'titulo' => htmlspecialchars($libro['titulo'], ENT_QUOTES, 'UTF-8')
    ];
}

function crearNotificacionCalificacion($conn, $idLibro, $tituloLibro, $calificacion, $resena) {
    $titulo = "Nueva Calificación";
    $contenido = "Se agregó una calificación de $calificacion estrellas para \"$tituloLibro\". Reseña: " . 
                 (strlen($resena) > 100 ? substr($resena, 0, 100) . "..." : $resena);
    $fechaHora = date('Y-m-d H:i:s');
    $leido = 0;
    $tipoUsuario = 1;
    $actions = "Ver Detalles";
    $idUsuario = 1;

    $sql = "INSERT INTO notificaciones (Id_Usuario, Titulo, Contenido, Fecha_Hora, Leido, Tipo_Usuario, ACTIONS) 
            VALUES (?, ?, ?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Error al preparar la consulta de notificación: ' . $conn->error);
    }
    $stmt->bind_param("isssiis", $idUsuario, $titulo, $contenido, $fechaHora, $leido, $tipoUsuario, $actions);
    if (!$stmt->execute()) {
        throw new Exception('Error al crear notificación: ' . $conn->error);
    }
    $stmt->close();
    
    // ✅ ENVIAR PUSH NOTIFICATIONS CON API V1
    enviarNotificacionesPush($conn, $idLibro, $tituloLibro, $calificacion, $resena);
}

/**
 * Envía notificaciones push usando API V1 con Service Account
 */
function enviarNotificacionesPush($conn, $idLibro, $tituloLibro, $calificacion, $resena) {
    // Obtener todos los tokens activos
    $sql = "SELECT token FROM fcm_tokens WHERE activo = 1";
    $result = $conn->query($sql);
    
    if (!$result || $result->num_rows === 0) {
        error_log('No hay tokens FCM activos para enviar notificaciones');
        return;
    }
    
    $tokens = [];
    while ($row = $result->fetch_assoc()) {
        $tokens[] = $row['token'];
    }
    
    // Ruta base de tu aplicación
    $basePath = '/TRABAJUCHOS/cuatri10B/domingo/AppWebProgresivaPushNoticiations/templatemo_595_3d_coverflow/';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $fullUrl = 'https://' . $host . $basePath . 'admin-calificaciones.html';
    
    $successCount = 0;
    $errorCount = 0;
    
    // Obtener token de acceso OAuth2
    $accessToken = obtenerAccessToken();
    if (!$accessToken) {
        error_log('❌ No se pudo obtener el token de acceso OAuth2 - usando método legacy');
        // Fallback a método legacy
        foreach ($tokens as $token) {
            if (enviarNotificacionLegacy($token, $idLibro, $tituloLibro, $calificacion, $basePath, $host)) {
                $successCount++;
            } else {
                $errorCount++;
            }
        }
    } else {
        // Usar API V1
        foreach ($tokens as $token) {
            if (enviarNotificacionV1($accessToken, $token, $idLibro, $tituloLibro, $calificacion, $basePath, $host)) {
                $successCount++;
            } else {
                $errorCount++;
            }
        }
    }
    
    error_log("📊 Resumen notificaciones: $successCount exitosas, $errorCount fallidas");
}

/**
 * Envía notificación usando API V1
 */
function enviarNotificacionV1($accessToken, $token, $idLibro, $tituloLibro, $calificacion, $basePath, $host) {
    $projectId = "decimob-7b0c7";
    $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";
    $fullUrl = 'https://' . $host . $basePath . 'admin-calificaciones.html';
    
    $messageData = [
        'message' => [
            'token' => $token,
            'notification' => [
                'title' => "📚 Nueva Calificación",
                'body' => "Se agregó una calificación de $calificacion estrellas para \"$tituloLibro\""
            ],
            'webpush' => [
                'headers' => [
                    'Urgency' => 'high'
                ],
                'notification' => [
                    'icon' => 'https://' . $host . $basePath . 'Libreria.png',
                    'badge' => 'https://' . $host . $basePath . 'Libreria.png',
                    'actions' => [
                        [
                            'action' => 'open',
                            'title' => '📖 Ver Calificaciones'
                        ]
                    ]
                ],
                'fcm_options' => [
                    'link' => $fullUrl
                ]
            ],
            'data' => [
                'idLibro' => (string)$idLibro,
                'tituloLibro' => $tituloLibro,
                'calificacion' => (string)$calificacion,
                'tipo' => 'nueva_calificacion',
                'timestamp' => (string)time(),
                'url' => $fullUrl
            ]
        ]
    ];
    
    $headers = [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($messageData));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        error_log("✅ Notificación V1 enviada exitosamente");
        return true;
    } else {
        error_log("❌ Error V1 - Código: $httpCode - Respuesta: $response");
        return false;
    }
}

/**
 * Obtiene access token para OAuth2 usando Service Account
 */
function obtenerAccessToken() {
    // Ruta al archivo JSON de tu Service Account
    $serviceAccountFile = __DIR__ . '/decimob-7b0c7-0d4ba45e54bd.json';
    
    if (!file_exists($serviceAccountFile)) {
        error_log('❌ Archivo de Service Account no encontrado: ' . $serviceAccountFile);
        return null;
    }
    
    $serviceAccount = json_decode(file_get_contents($serviceAccountFile), true);
    
    // Crear JWT
    $header = [
        'alg' => 'RS256',
        'typ' => 'JWT'
    ];
    
    $now = time();
    $payload = [
        'iss' => $serviceAccount['client_email'],
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
        'aud' => 'https://oauth2.googleapis.com/token',
        'exp' => $now + 3600,
        'iat' => $now
    ];
    
    $jwtHeader = base64_encode(json_encode($header));
    $jwtPayload = base64_encode(json_encode($payload));
    $jwtUnsigned = $jwtHeader . '.' . $jwtPayload;
    
    // Firmar JWT
    $privateKey = $serviceAccount['private_key'];
    openssl_sign($jwtUnsigned, $signature, $privateKey, OPENSSL_ALGO_SHA256);
    $jwtSignature = base64_encode($signature);
    
    $jwt = $jwtUnsigned . '.' . $jwtSignature;
    
    // Obtener access token
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        error_log('✅ Token de acceso obtenido exitosamente');
        return $data['access_token'];
    } else {
        error_log('❌ Error obteniendo token: ' . $response);
        return null;
    }
}

/**
 * Método legacy temporal como fallback
 */
function enviarNotificacionLegacy($token, $idLibro, $tituloLibro, $calificacion, $basePath, $host) {
    $data = [
        'to' => $token,
        'notification' => [
            'title' => "📚 Nueva Calificación",
            'body' => "Se agregó una calificación de $calificacion estrellas para \"$tituloLibro\"",
            'icon' => $basePath . 'Libreria.png',
            'badge' => $basePath . 'Libreria.png',
            'click_action' => 'https://' . $host . $basePath . 'admin-calificaciones.html'
        ],
        'data' => [
            'idLibro' => (string)$idLibro,
            'tituloLibro' => $tituloLibro,
            'calificacion' => (string)$calificacion,
            'tipo' => 'nueva_calificacion',
            'timestamp' => (string)time()
        ]
    ];
    
    $headers = [
        'Authorization: key=AAAAj8QZ5FKp5frkuflVg_H-63ltfHQ6rzG3L5p7-Xc5MpA0-ngeAvIH4S6xGKgcEuc9nibH3RbPjb_w7Co6YVZqJw',
        'Content-Type: application/json'
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://fcm.googleapis.com/fcm/send');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        error_log("✅ Notificación legacy enviada");
        return true;
    } else {
        error_log("❌ Error legacy - Código: $httpCode");
        return false;
    }
}

function guardarTokenFCM($conn, $token) {
    $sql = "SELECT id FROM fcm_tokens WHERE token = ? AND activo = 1";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $sql = "INSERT INTO fcm_tokens (token, fecha_registro, activo) VALUES (?, NOW(), 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("s", $token);
        
        if ($stmt->execute()) {
            respond(true, 'Token guardado exitosamente');
        } else {
            respond(false, 'Error al guardar token: ' . $conn->error);
        }
    } else {
        respond(true, 'Token ya existe');
    }
    $stmt->close();
}

function marcarTokenInactivo($conn, $token) {
    $sql = "UPDATE fcm_tokens SET activo = 0 WHERE token = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $token);
    
    if ($stmt->execute()) {
        error_log("✅ Token marcado como inactivo");
    } else {
        error_log("❌ Error marcando token como inactivo");
    }
    $stmt->close();
}
?>