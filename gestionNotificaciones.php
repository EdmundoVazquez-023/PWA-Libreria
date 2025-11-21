<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');

// Configuración de la conexión a la base de datos
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "librocalif";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    error_log('Conexión fallida: ' . $conn->connect_error);
    echo json_encode(['success' => false, 'message' => 'Conexión fallida: ' . $conn->connect_error]);
    exit();
}

$action = $_GET['action'] ?? '';

if ($action === 'lista') {
    // Consulta para obtener todas las notificaciones, ordenadas por fecha descendente
    $sql = "SELECT Id_Notificacion, Id_Usuario, Titulo, Contenido, Fecha_Hora, Leido, Tipo_Usuario, ACTIONS 
            FROM notificaciones 
            ORDER BY Fecha_Hora DESC";
    $result = $conn->query($sql);
    $notificaciones = [];
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $notificaciones[] = $row;
        }
    }
    error_log('Lista de notificaciones recuperada: ' . json_encode($notificaciones));
    echo json_encode(['success' => true, 'notificaciones' => $notificaciones]);
} else {
    error_log('Acción no válida: ' . $action);
    echo json_encode(['success' => false, 'message' => 'Acción no válida.']);
}

$conn->close();
?>