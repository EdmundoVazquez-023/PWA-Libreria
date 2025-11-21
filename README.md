Documentación: Configuración e Implementación de Push Notifications con Firebase 

 

Introducción 

Las Push Notifications son mensajes que pueden enviarse directamente a los dispositivos de los usuarios incluso cuando no están usando activamente la aplicación. En este documento se detalla la implementación completa de un sistema de notificaciones push utilizando Firebase Cloud Messaging (FCM) para una aplicación web progresiva (PWA) de gestión de librería. 

 

1. Creación del Proyecto Firebase 

Acceder a Firebase Console 

Crear nuevo proyecto o seleccionar existente 

Configurar el nombre del proyecto (decimob-7b0c7) 

 

2. Configuración de Aplicación Web 

En la sección "Project settings" → "General" 

Agregar aplicación web 

Registrar la aplicación con un nombre identificativo 

Obtener la configuración de Firebase que incluye: 

apiKey 

authDomain 

projectId 

storageBucket 

messagingSenderId 

appId 

MeasurementId 

Basicamente es este codigo en firebase 

 

 

3. Configuración de Cloud Messaging 

En la sección "Cloud Messaging" 

Generar VAPID Key (Very Advanced Product ID Key) 

 

Configurar credenciales de Service Account para API V1 

 

Estructura de Archivos 

templatemo_595_3d_coverflow/ 
├── firebase-config.js          # Configuración principal 
├── firebase-messaging-sw.js    # Service Worker 
├── gestionCalificaciones.php   # Backend calificaciones 
├── gestionLibros.php          # Backend libros 
└── archivos de la aplicación 

Configuración de Firebase 

Archivo: firebase-config.js 

 

Propósito: Este archivo contiene la configuración esencial para inicializar Firebase en el cliente. 

Componentes Clave: 

firebaseConfig: Credenciales del proyecto Firebase 

VAPID_KEY: Clave pública para autenticación de Web Push 

 

Service Worker para Notificaciones 

Archivo: firebase-messaging-sw.js 

 

Carga de librerías de Firebase: permite usar el servicio de mensajería en el Service Worker. 

Inicialización de Firebase: conecta el Service Worker con el proyecto configurado en Firebase. 

Recepción de mensajes en segundo plano: detecta notificaciones cuando la página está cerrada o minimizada. 

Personalización de notificaciones: cambia título, cuerpo, ícono y acciones según el tipo de mensaje recibido. 

Mostrar notificaciones: envía la alerta visual al usuario con botones y datos específicos. 

Manejo del clic en notificaciones: decide qué hacer cuando el usuario interactúa (abrir página, enfocar, cerrar). 

Apertura o enfoque de ventana: evita pestañas duplicadas enfocando una existente o creando una nueva si no hay. 

Registro del cierre de notificaciones: detecta cuando el usuario descarta una sin interactuar. 

Instalación del Service Worker: prepara y registra el archivo para su uso en la web. 

Activación del Service Worker: permite que empiece a controlar la aplicación sin esperar recarga. 

Recepción de mensajes desde la app: permite que la aplicación envíe instrucciones especiales, como actualizar el SW.  

Para descargar el archivo decimob-7b0c7-0d4ba45e54bd.json 

Que basicamente contiene: 

Se obtiene aqui en el apartado de cuenta de servicio y dar en generar la clave privada 

 

Integración Backend con PHP 

------ Archivo: gestionCalificaciones.php ------ 

1. Manejo de Tokens FCM 

 

2. Envío de Notificaciones Push 

3. Autenticación OAuth2 para API V1 

 

4. Envío mediante API V1 

 

En resumen:  

respond($success, $message, $data = []), Envía respuestas en formato JSON al frontend, incluyendo mensajes y datos. 

libroExists($conn, $idLibro), Valida si el ID de un libro existe en la base de datos antes de calificarlo. 

obtenerLibroInfo($conn, $idLibro), Obtiene información básica del libro, como el título, para usar en notificaciones y registros. 

crearNotificacionCalificacion(...), Registra la notificación en la tabla notificaciones cuando alguien califica un libro. 

enviarNotificacionesPush(...), Coordina el envío masivo de push notifications a todos los dispositivos registrados. 

enviarNotificacionV1(...), Envía notificaciones usando la API moderna (V1) de Firebase con autenticación OAuth2. 

obtenerAccessToken(), Genera un token de acceso OAuth2 usando una Service Account para poder usar la API V1. 

enviarNotificacionLegacy(...), Envía notificaciones usando el método antiguo (Legacy) como respaldo si falla el V1. 

guardarTokenFCM($conn, $token), Guarda el token del dispositivo para permitir recibir notificaciones push. 

marcarTokenInactivo($conn, $token), Marca un token como inactivo cuando ya no se debe usar para enviar notificaciones. 

 

--------------- Archivo: gestionLibros.php  ------------------ 

1. enviarNotificacionesPush($conn, $titulo, $autor, $fechaPublicacion) 

Propósito: Coordinar el envío de notificaciones push para nuevos libros 

 

Flujo: 

Obtiene tokens FCM activos de la base de datos 

Intenta usar API V1 con OAuth2 

Fallback a método legacy si falla la autenticación 

Envía notificaciones a todos los tokens 

 

2. enviarNotificacionLibroV1($accessToken, $token, $titulo, $autor, $fechaPublicacion, $basePath, $host) 

Propósito: Enviar notificación usando Firebase API V1 

 

Características API V1: 

Usa OAuth2 Bearer token 

Estructura moderna de payload 

Soporte para webpush con acciones 

Datos personalizados en data 

 

3. enviarNotificacionLibroLegacy($token, $titulo, $autor, $fechaPublicacion, $basePath, $host) 

Propósito: Envío alternativo usando API legacy FCM 

 

 

Diferencias con V1: 

Usa API key en header en lugar de OAuth2 

Estructura de payload diferente 

click_action en lugar de fcm_options.link 

Endpoint legacy /fcm/send 

 

4. obtenerAccessToken() 

Propósito: Obtener token OAuth2 para autenticación API V1 

 

 

Proceso OAuth2: 

Lee Service Account JSON 

Crea JWT firmado con clave privada 

Intercambia JWT por access token 

Retorna token para API calls 

 

5. guardarTokenFCM($conn, $token) 

Propósito: Almacenar tokens FCM en base de datos para envíos futuros 

 

Gestión de Tokens: 

Evita duplicados activos 

Marca tokens como activos/inactivos 

Permite limpieza de tokens expirados 

 

Flujo de Ejecución para Push Notifications 

Al agregar nuevo libro: 

crearNotificacionLibro() → Registro en BD 

enviarNotificacionesPush() → Coordina envío 

obtenerAccessToken() → Autenticación OAuth2 

enviarNotificacionLibroV1() o enviarNotificacionLibroLegacy() → Envío real 

guardarTokenFCM() → Gestión de tokens (cuando se registran) 

Tipos de Notificación: 

tipo: 'nuevo_libro' → Para notificaciones de libros 

tipo: 'nueva_calificacion' → Para notificaciones de calificaciones 

 

 

Flujo de Notificaciones 

1. Registro del Service Worker 

 

2. Solicitud de Permisos y Obtención de Token 

 

3. Recepción de Notificaciones 

Primer plano: Manejado por onMessage en la aplicación 

Segundo plano: Manejado por onBackgroundMessage en el Service Worker 

4. Manejo de Interacciones 

Clic en notificación: Navegación a página específica 

Clic en acciones: Ejecución de acciones personalizadas 

Cierre: Limpieza de notificación 

 

Manejo de Tokens FCM 

Base de Datos 

sql 

CREATE TABLE fcm_tokens ( 
   id INT AUTO_INCREMENT PRIMARY KEY, 
   token TEXT NOT NULL, 
   fecha_registro DATETIME NOT NULL, 
   activo TINYINT DEFAULT 1 
); 

 

Gestión de Tokens 

Registro: Cuando el usuario concede permisos 

Almacenamiento: En base de datos con estado activo 

Invalidación: Cuando el token expira o se revocan permisos 

Limpieza: Tokens inactivos o expirados 

 

 

 