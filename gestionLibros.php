<?php
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
header('Content-Type: application/json; charset=utf-8');

// Configuración de la conexión a la base de datos
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

// Configurar codificación UTF-8
$conn->set_charset('utf8mb4');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
if (!$action) {
    respond(false, 'Acción no especificada');
    exit();
}

if ($action === 'guardar') {
    $titulo = filter_input(INPUT_POST, 'titulo', FILTER_SANITIZE_STRING);
    $autor = filter_input(INPUT_POST, 'autor', FILTER_SANITIZE_STRING);
    $fechaPublicacion = filter_input(INPUT_POST, 'fechaPublicacion', FILTER_SANITIZE_STRING);
    $resena = filter_input(INPUT_POST, 'resena', FILTER_SANITIZE_STRING);
    $portada = $_FILES['portada'] ?? null;

    // Validaciones
    if (!$titulo || !$autor || !$fechaPublicacion || !$resena) {
        respond(false, 'Todos los campos obligatorios son requeridos');
        exit();
    }
    if (strlen($titulo) > 255) {
        respond(false, 'El título no debe exceder 255 caracteres');
        exit();
    }
    if (strlen($resena) > 1000) {
        respond(false, 'La reseña no debe exceder 1000 caracteres');
        exit();
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaPublicacion) || !strtotime($fechaPublicacion)) {
        respond(false, 'Formato de fecha inválido (YYYY-MM-DD)');
        exit();
    }

    $portadaData = null;
    if ($portada && $portada['error'] === UPLOAD_ERR_OK) {
        if ($portada['size'] > 5 * 1024 * 1024) {
            respond(false, 'La portada no debe exceder 5MB');
            exit();
        }
        $mimeType = mime_content_type($portada['tmp_name']);
        if (!in_array($mimeType, ['image/jpeg', 'image/png', 'image/gif'])) {
            respond(false, 'La portada debe ser una imagen (JPEG, PNG, GIF)');
            exit();
        }
        $portadaData = file_get_contents($portada['tmp_name']);
    }

    $conn->begin_transaction();
    try {
        // Insertar libro
        $sql = "INSERT INTO libros (titulo, autor, fechaPublicacion, portada, resena) VALUES (?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new Exception('Error al preparar la consulta de libro: ' . $conn->error);
        }
        $stmt->bind_param("sssbs", $titulo, $autor, $fechaPublicacion, $portadaData, $resena);
        if ($portadaData !== null) {
            $stmt->send_long_data(3, $portadaData);
        }
        if (!$stmt->execute()) {
            throw new Exception('Error al guardar libro: ' . $conn->error);
        }
        $idLibro = $conn->insert_id;
        $stmt->close();

        // Crear notificación en base de datos
        crearNotificacionLibro($conn, $titulo, $autor, $fechaPublicacion);

        $conn->commit();
        respond(true, 'Libro guardado exitosamente');
    } catch (Exception $e) {
        $conn->rollback();
        error_log('Error en transacción: ' . $e->getMessage());
        respond(false, 'Error al guardar: ' . $e->getMessage());
    }
} elseif ($action === 'lista') {
    $sql = "SELECT titulo, autor, fechaPublicacion, resena, portada FROM libros";
    $result = $conn->query($sql);
    $libros = [];
    if ($result && $result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $libros[] = [
                'titulo' => htmlspecialchars($row['titulo'], ENT_QUOTES, 'UTF-8'),
                'autor' => htmlspecialchars($row['autor'], ENT_QUOTES, 'UTF-8'),
                'fechaPublicacion' => $row['fechaPublicacion'],
                'resena' => htmlspecialchars($row['resena'], ENT_QUOTES, 'UTF-8'),
                'portada' => $row['portada'] ? base64_encode($row['portada']) : null
            ];
        }
    }
    respond(true, 'Lista de libros recuperada', ['libros' => $libros]);
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

/**
 * Responde con un formato JSON estándar
 */
function respond($success, $message, $data = []) {
    $response = ['success' => $success, 'message' => $message];
    if ($data) {
        $response = array_merge($response, $data);
    }
    echo json_encode($response);
}

/**
 * Crea una notificación para un nuevo libro
 */
function crearNotificacionLibro($conn, $titulo, $autor, $fechaPublicacion) {
    $tituloNotif = "Nuevo Libro Agregado";
    $contenido = "Se agregó el libro \"$titulo\" del autor $autor. Fecha de publicación: " . 
                 date('d/m/Y', strtotime($fechaPublicacion));
    $fechaHora = date('Y-m-d H:i:s');
    $leido = 0;
    $tipoUsuario = 1;
    $actions = "Ver Libro";
    $idUsuario = 1;

    $sql = "INSERT INTO notificaciones (Id_Usuario, Titulo, Contenido, Fecha_Hora, Leido, Tipo_Usuario, ACTIONS) 
            VALUES (?, ?, ?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Error al preparar la consulta de notificación: ' . $conn->error);
    }
    $stmt->bind_param("isssiis", $idUsuario, $tituloNotif, $contenido, $fechaHora, $leido, $tipoUsuario, $actions);
    if (!$stmt->execute()) {
        throw new Exception('Error al crear notificación: ' . $conn->error);
    }
    $stmt->close();
    
    // ✅ ENVIAR PUSH NOTIFICATIONS
    enviarNotificacionesPush($conn, $titulo, $autor, $fechaPublicacion);
}

/**
 * Envía notificaciones push para nuevos libros
 */
function enviarNotificacionesPush($conn, $titulo, $autor, $fechaPublicacion) {
    // Obtener todos los tokens activos
    $sql = "SELECT token FROM fcm_tokens WHERE activo = 1";
    $result = $conn->query($sql);
    
    if (!$result || $result->num_rows === 0) {
        error_log('No hay tokens FCM activos para enviar notificaciones de libros');
        return;
    }
    
    $tokens = [];
    while ($row = $result->fetch_assoc()) {
        $tokens[] = $row['token'];
    }
    
    // Ruta base de tu aplicación
    $basePath = '/TRABAJUCHOS/cuatri10B/domingo/AppWebProgresivaPushNoticiations/templatemo_595_3d_coverflow/';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $fechaFormateada = date('d/m/Y', strtotime($fechaPublicacion));
    
    $successCount = 0;
    $errorCount = 0;
    
    // Obtener token de acceso OAuth2
    $accessToken = obtenerAccessToken();
    if (!$accessToken) {
        error_log('❌ No se pudo obtener el token de acceso OAuth2 - usando método legacy para libros');
        // Fallback a método legacy
        foreach ($tokens as $token) {
            if (enviarNotificacionLibroLegacy($token, $titulo, $autor, $fechaFormateada, $basePath, $host)) {
                $successCount++;
            } else {
                $errorCount++;
            }
        }
    } else {
        // Usar API V1
        foreach ($tokens as $token) {
            if (enviarNotificacionLibroV1($accessToken, $token, $titulo, $autor, $fechaFormateada, $basePath, $host)) {
                $successCount++;
            } else {
                $errorCount++;
            }
        }
    }
    
    error_log("📊 Resumen notificaciones de libros: $successCount exitosas, $errorCount fallidas");
}

/**
 * Envía notificación de libro usando API V1
 */
function enviarNotificacionLibroV1($accessToken, $token, $titulo, $autor, $fechaPublicacion, $basePath, $host) {
    $projectId = "decimob-7b0c7";
    $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";
    $fullUrl = 'https://' . $host . $basePath . 'admin-libros.html';
    
    $messageData = [
        'message' => [
            'token' => $token,
            'notification' => [
                'title' => "📚 Nuevo Libro Agregado",
                'body' => "$titulo - por $autor"
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
                            'title' => '📖 Ver Libros'
                        ]
                    ]
                ],
                'fcm_options' => [
                    'link' => $fullUrl
                ]
            ],
            'data' => [
                'titulo' => $titulo,
                'autor' => $autor,
                'fechaPublicacion' => $fechaPublicacion,
                'tipo' => 'nuevo_libro',  // ← IMPORTANTE: Para que el Service Worker lo identifique
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
        error_log("✅ Notificación de libro V1 enviada exitosamente");
        return true;
    } else {
        error_log("❌ Error V1 en libro - Código: $httpCode - Respuesta: $response");
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
        error_log('✅ Token de acceso obtenido exitosamente para libros');
        return $data['access_token'];
    } else {
        error_log('❌ Error obteniendo token para libros: ' . $response);
        return null;
    }
}

/**
 * Método legacy temporal como fallback para libros
 */
function enviarNotificacionLibroLegacy($token, $titulo, $autor, $fechaPublicacion, $basePath, $host) {
    $data = [
        'to' => $token,
        'notification' => [
            'title' => "📚 Nuevo Libro Agregado",
            'body' => "$titulo - por $autor",
            'icon' => $basePath . 'Libreria.png',
            'badge' => $basePath . 'Libreria.png',
            'click_action' => 'https://' . $host . $basePath . 'admin-libros.html'
        ],
        'data' => [
            'titulo' => $titulo,
            'autor' => $autor,
            'fechaPublicacion' => $fechaPublicacion,
            'tipo' => 'nuevo_libro',  // ← IMPORTANTE: Para que el Service Worker lo identifique
            'timestamp' => (string)time()
        ]
    ];
    
    $headers = [
        'Authorization: key=AIzaSyBocl7rUMxcPKu_RdP55K0tn_fs4WQuWM0',
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
        error_log("✅ Notificación de libro legacy enviada");
        return true;
    } else {
        error_log("❌ Error legacy en libro - Código: $httpCode");
        return false;
    }
}

/**
 * Guarda token FCM en la base de datos
 */
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
?>