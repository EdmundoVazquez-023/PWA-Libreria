Sistema de Notificaciones Push con Firebase

Equipo: Adelaida Cruz Cordero
Juan Edmundo Vazquez Rodriguez

Descripción del Proyecto
Este proyecto implementa un sistema completo de notificaciones push utilizando Firebase Cloud Messaging (FCM) para una aplicación web progresiva (PWA) de gestión de librería. El sistema permite enviar mensajes directos a los dispositivos de los usuarios incluso cuando no están usando activamente la aplicación, manteniéndolos informados sobre nuevas adiciones de libros y calificaciones realizadas por otros usuarios.

Configuración e Implementación
Configuración de Firebase
El proyecto inicia con la creación y configuración de un proyecto en Firebase Console. Se establece una aplicación web dentro del proyecto, obteniendo las credenciales necesarias como API Key, Auth Domain, Project ID y otros parámetros esenciales para la integración. Una parte crucial de la configuración es la generación de la VAPID Key (Very Advanced Product ID Key), que se utiliza para la autenticación de Web Push.

Service Worker para Notificaciones
Se implementa un Service Worker especializado (firebase-messaging-sw.js) que maneja la recepción de notificaciones en segundo plano. Este componente es fundamental ya que permite procesar mensajes cuando la aplicación está cerrada o minimizada. El Service Worker se encarga de personalizar las notificaciones según el tipo de mensaje recibido, mostrando alertas visuales con botones y datos específicos, además de gestionar las interacciones del usuario como clics en las notificaciones y su cierre.

Integración Backend con PHP
El backend desarrollado en PHP consta de dos módulos principales: gestionCalificaciones.php y gestionLibros.php. Estos archivos contienen la lógica para gestionar las operaciones relacionadas con calificaciones de libros y administración del catálogo, respectivamente. Ambos módulos incorporan funcionalidades para enviar notificaciones push cuando se realizan acciones relevantes en el sistema.

Funcionalidades Principales
Manejo de Tokens FCM
El sistema implementa una gestión robusta de tokens FCM, que son identificadores únicos para cada dispositivo registrado. Los tokens se almacenan en una base de datos y se marcan como activos o inactivos según su estado actual. Esta gestión incluye verificación de duplicados, inserción de nuevos tokens y desactivación de tokens que ya no son válidos.

Envío de Notificaciones Push
El sistema emplea una estrategia dual para el envío de notificaciones. Utiliza principalmente la API moderna de Firebase Cloud Messaging (V1) que requiere autenticación OAuth2, pero mantiene como respaldo la API legacy para casos donde la autenticación moderna falle. Esta aproximación garantiza la confiabilidad del sistema.

Autenticación OAuth2 para API V1
Para utilizar la API V1 de Firebase, el sistema implementa autenticación OAuth2 mediante el uso de Service Accounts. Este proceso implica la creación de JWT (JSON Web Tokens) firmados con la clave privada de la cuenta de servicio, los cuales se intercambian por tokens de acceso que autorizan las peticiones a la API.

Flujo de Notificaciones
Registro del Service Worker
La aplicación principal registra el Service Worker, que es esencial para manejar notificaciones en segundo plano. Este registro permite que el Service Worker comience a controlar la aplicación sin necesidad de recargarla.

Solicitud de Permisos y Obtención de Token
El sistema solicita permisos al usuario para mostrar notificaciones. Una vez concedidos los permisos, obtiene el token FCM del dispositivo y lo envía al backend para su almacenamiento y uso futuro en el envío de notificaciones.

Recepción y Manejo de Notificaciones
Las notificaciones se manejan diferentemente según el estado de la aplicación. Cuando está en primer plano, la aplicación maneja los mensajes directamente. En segundo plano, el Service Worker se encarga de recibir y mostrar las notificaciones. El sistema también gestiona las interacciones del usuario, como clics en las notificaciones o en sus acciones personalizadas.

Tipos de Notificación
El sistema soporta dos tipos principales de notificaciones:

Nuevo Libro: Se activa cuando se agrega un nuevo libro al catálogo

Nueva Calificación: Se activa cuando un usuario califica un libro existente

Conclusión
Esta implementación representa un sistema completo y profesional de notificaciones push que integra tecnologías modernas como Firebase Cloud Messaging, Service Workers y autenticación OAuth2. La arquitectura diseñada permite una comunicación efectiva con los usuarios, mejorando la experiencia general de la aplicación de gestión de librería mediante notificaciones oportunas y relevantes sobre las actividades más importantes del sistema.
