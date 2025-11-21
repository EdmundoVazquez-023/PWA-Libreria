<?php
// guardar_token.php
header('Content-Type: application/json; charset=utf-8');

// Configuración de la base de datos
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "librocalif";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    echo json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos']);
    exit();
}

$conn->set_charset('utf8mb4');

// Leer datos JSON
$input = json_decode(file_get_contents('php://input'), true);
$token = $input['token'] ?? '';
$action = $input['action'] ?? '';

if ($action === 'guardar_token' && !empty($token)) {
    // Verificar si el token ya existe
    $sql = "SELECT id FROM fcm_tokens WHERE token = ? AND activo = 1";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        // Insertar nuevo token
        $sql = "INSERT INTO fcm_tokens (token, fecha_registro, activo) VALUES (?, NOW(), 1)";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("s", $token);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Token guardado exitosamente']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al guardar token']);
        }
    } else {
        echo json_encode(['success' => true, 'message' => 'Token ya existe']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Token vacío o acción inválida']);
}

$conn->close();
?>