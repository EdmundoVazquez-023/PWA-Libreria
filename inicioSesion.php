<?php
header('Content-Type: application/json');

// Configuración de la conexión a la base de datos
$servername = "localhost"; // Cambia si tu servidor MySQL no es local
$username = "root"; // Usuario root
$password = ""; // Deja vacío si no hay contraseña, o pon la contraseña si la configuraste
$dbname = "librocalif"; // Nombre de la base de datos

try {
    // Crear conexión
    $conn = new mysqli($servername, $username, $password, $dbname);

    // Verificar conexión
    if ($conn->connect_error) {
        throw new Exception('Conexión fallida: ' . $conn->connect_error);
    }

    // Recibir datos del formulario
    $correo = $_POST['email'] ?? ''; // Mapeamos 'email' del formulario a 'Correo_Electronico' en la BD
    $password = $_POST['password'] ?? '';

    // Validar entrada
    if (empty($correo) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Correo y contraseña son requeridos.']);
        exit();
    }

    // Consulta a la tabla 'usuarios' ajustada con las columnas reales
    $sql = "SELECT * FROM usuarios WHERE Correo_Electronico = ? AND Contrasena = ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Error en la preparación de la consulta: ' . $conn->error);
    }

    // Bind de parámetros
    $stmt->bind_param("ss", $correo, $password);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        // Inicio de sesión exitoso
        session_start();
        $_SESSION['loggedin'] = true;
        $_SESSION['correo'] = $correo; // Guardamos el correo en la sesión
        echo json_encode(['success' => true, 'message' => 'Inicio de sesión exitoso.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Correo o contraseña incorrectos.']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
} finally {
    if (isset($stmt)) $stmt->close();
    if (isset($conn)) $conn->close();
}
?>
