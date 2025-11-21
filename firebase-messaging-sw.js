// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBocl7rUMxcPKu_RdP55K0tn_fs4WQuWM0",
    authDomain: "decimob-7b0c7.firebaseapp.com",
    projectId: "decimob-7b0c7",
    storageBucket: "decimob-7b0c7.firebasestorage.app",
    messagingSenderId: "371672420344",
    appId: "1:371672420344:web:5c7bde6c0f4a45310cd00d",
    measurementId: "G-155H3BPD5Z"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Ruta base CORREGIDA - usando minúsculas como en tu estructura real
const APP_BASE_PATH = '/trabajuchos/cuatri10B/domingo/AppWebProgresivaPushNoticiations/templatemo_595_3d_coverflow/';

// Manejar notificaciones en segundo plano
messaging.onBackgroundMessage((payload) => {
    console.log('📬 Mensaje recibido en segundo plano:', payload);
    
    // Determinar el tipo de notificación basado en el payload
    const data = payload.data || {};
    const notificationType = data.type || 'default';
    
    let notificationTitle, notificationBody, tag, targetUrl, actions;

    switch (notificationType) {
        case 'nuevo_libro':
            notificationTitle = payload.notification?.title || '📚 Nuevo Libro Agregado';
            notificationBody = payload.notification?.body || `Libro: ${data.titulo || 'Nuevo libro'} - ${data.autor || 'Autor'}`;
            tag = 'nuevo-libro';
            targetUrl = 'admin-libros.html';
            actions = [
                {
                    action: 'open',
                    title: '📖 Ver Libros'
                },
                {
                    action: 'close',
                    title: '❌ Cerrar'
                }
            ];
            break;
            
        case 'nueva_calificacion':
        default:
            notificationTitle = payload.notification?.title || '📚 Nueva Calificación';
            notificationBody = payload.notification?.body || 'Se ha agregado una nueva calificación al sistema';
            tag = 'nueva-calificacion';
            targetUrl = 'admin-calificaciones.html';
            actions = [
                {
                    action: 'open',
                    title: '📖 Ver Calificaciones'
                },
                {
                    action: 'close',
                    title: '❌ Cerrar'
                }
            ];
            break;
    }

    const notificationOptions = {
        body: notificationBody,
        icon: APP_BASE_PATH + 'Libreria.png',
        badge: APP_BASE_PATH + 'Libreria.png',
        data: data,
        tag: tag,
        requireInteraction: true,
        actions: actions
    };
    
    console.log('🔔 Mostrando notificación:', notificationTitle, 'Tipo:', notificationType);
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar clic en notificación - VERSIÓN MEJORADA
self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Notificación clickeada:', event.notification.tag);
    event.notification.close();
    
    const action = event.action;
    const notificationData = event.notification.data || {};
    const notificationType = notificationData.type || 'default';
    
    if (action === 'close') {
        console.log('❌ Notificación cerrada');
        return;
    }
    
    // Determinar la URL destino basado en el tipo de notificación
    let targetPage;
    switch (notificationType) {
        case 'nuevo_libro':
            targetPage = 'admin-libros.html';
            break;
        case 'nueva_calificacion':
        default:
            targetPage = 'admin-calificaciones.html';
            break;
    }
    
    // RUTA CORREGIDA - usando la ruta exacta de tu proyecto
    const urlToOpen = new URL(APP_BASE_PATH + targetPage, self.location.origin).href;
    console.log('🎯 Intentando abrir:', urlToOpen);

    event.waitUntil(
        clients.matchAll({ 
            type: 'window',
            includeUncontrolled: true 
        }).then((windowClients) => {
            console.log('🔍 Buscando ventanas existentes...');
            
            // Estrategia mejorada de búsqueda de ventanas
            for (const client of windowClients) {
                console.log('Ventana encontrada:', client.url);
                
                // Buscar por la ruta completa
                if (client.url.includes(APP_BASE_PATH + targetPage)) {
                    console.log('📍 Enfocando ventana existente específica:', targetPage);
                    return client.focus();
                }
                
                // Buscar por cualquier página de la aplicación
                if (client.url.includes(APP_BASE_PATH)) {
                    console.log('📍 Enfocando ventana de la aplicación');
                    // Navegar a la página correcta
                    if (client.url.includes(APP_BASE_PATH + targetPage)) {
                        return client.focus();
                    } else {
                        // Si está en otra página, navegar a la correcta
                        return client.navigate(APP_BASE_PATH + targetPage).then(() => client.focus());
                    }
                }
            }
            
            // Si no hay ventanas existentes, abrir nueva
            console.log('🆕 Abriendo nueva ventana en:', urlToOpen);
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        }).catch(error => {
            console.error('❌ Error al manejar clic de notificación:', error);
            // Fallback: abrir en nueva ventana
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Manejar cierre de notificación
self.addEventListener('notificationclose', (event) => {
    console.log('📪 Notificación cerrada:', event.notification.tag);
});

// Eventos de instalación y activación
self.addEventListener('install', (event) => {
    console.log('✅ Service Worker instalado');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker activado');
    event.waitUntil(self.clients.claim());
});

// Manejar mensajes desde la aplicación
self.addEventListener('message', (event) => {
    console.log('📨 Mensaje recibido en Service Worker:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});