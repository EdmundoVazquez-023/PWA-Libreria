// Función para obtener la URL del service worker (mejorada)
function url(path) {
    // Para desarrollo local, manejar mejor las rutas
    if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
        return path; // Ruta relativa simple para localhost
    }
    // Para producción, usar URL absoluta
    return new URL(path, self.location).href;
}

// Función principal para registrar todo
function regAll(fun) {
    regWorker(fun)
        .then(() => regSyncNotifications())
        .then(() => regPeriodicSyncNotifications())
        .catch(error => {
            // Fallar silenciosamente en producción
        });
}

// Registrar Service Worker
async function regWorker(fun) {
    try {
        const swPath = 'pwa-sw.js';
        
        const registration = await navigator.serviceWorker.register(swPath);
        
        if (typeof fun === "function") {
            fun();
        }
        
        // Esperar a que el Service Worker esté activo
        if (registration.installing) {
            await new Promise(resolve => {
                registration.installing.addEventListener('statechange', function() {
                    if (this.state === 'activated') {
                        resolve();
                    }
                });
            });
        }
        
        return registration;
    } catch (error) {
        throw error;
    }
}

// Registrar sync para notificaciones
async function regSyncNotifications() {
    try {
        const reg = await navigator.serviceWorker.ready;
        if ("sync" in reg) {
            await reg.sync.register(SYNCEVENTNAME);
        }
    } catch (err) {
        // Silencioso
    }
}

// Registrar sync periódico
async function regPeriodicSyncNotifications() {
    try {
        const reg = await navigator.serviceWorker.ready;
        if ("periodicSync" in reg) {
            const status = await navigator.permissions.query({
                name: "periodic-background-sync"
            });

            if (status.state === "granted") {
                await reg.periodicSync.register(PERIODICSYNCEVENTNAME, {
                    minInterval: 24 * 60 * 60 * 1000 // 24 horas
                });
            }
        }
    } catch (err) {
        // Silencioso
    }
}

// Función para forzar sincronización de calificaciones pendientes
async function forceSyncCalificaciones() {
    try {
        if (!navigator.serviceWorker.controller) {
            return false;
        }

        const reg = await navigator.serviceWorker.ready;
        if ("sync" in reg) {
            await reg.sync.register(CALIFICACIONES_SYNC);
            showSyncNotification("Sincronización iniciada", "Las calificaciones pendientes se están sincronizando.");
            return true;
        }
        return false;
    } catch (err) {
        showSyncNotification("Error de sincronización", "No se pudo iniciar la sincronización.", true);
        return false;
    }
}

// Función para forzar sincronización de libros pendientes
async function forceSyncLibros() {
    try {
        if (!navigator.serviceWorker.controller) {
            return false;
        }

        const reg = await navigator.serviceWorker.ready;
        if ("sync" in reg) {
            await reg.sync.register(LIBROS_SYNC);
            showSyncNotification("Sincronización iniciada", "Los libros pendientes se están sincronizando.");
            return true;
        }
        return false;
    } catch (err) {
        showSyncNotification("Error de sincronización", "No se pudo iniciar la sincronización.", true);
        return false;
    }
}

// Función para verificar si hay calificaciones pendientes
async function checkPendingCalificaciones() {
    return new Promise((resolve) => {
        if (!navigator.serviceWorker.controller) {
            resolve(0);
            return;
        }

        const messageChannel = new MessageChannel();
        
        const timeout = setTimeout(() => {
            resolve(0);
        }, 3000);

        messageChannel.port1.onmessage = function(event) {
            clearTimeout(timeout);
            if (event.data.type === 'PENDING_CALIFICACIONES_COUNT') {
                resolve(event.data.count);
            }
        };

        try {
            navigator.serviceWorker.controller.postMessage({
                type: 'GET_PENDING_CALIFICACIONES_COUNT'
            }, [messageChannel.port2]);
        } catch (error) {
            clearTimeout(timeout);
            resolve(0);
        }
    });
}

// Función para verificar si hay libros pendientes
async function checkPendingLibros() {
    return new Promise((resolve) => {
        if (!navigator.serviceWorker.controller) {
            resolve(0);
            return;
        }

        const messageChannel = new MessageChannel();
        
        const timeout = setTimeout(() => {
            resolve(0);
        }, 3000);

        messageChannel.port1.onmessage = function(event) {
            clearTimeout(timeout);
            if (event.data.type === 'PENDING_LIBROS_COUNT') {
                resolve(event.data.count);
            }
        };

        try {
            navigator.serviceWorker.controller.postMessage({
                type: 'GET_PENDING_LIBROS_COUNT'
            }, [messageChannel.port2]);
        } catch (error) {
            clearTimeout(timeout);
            resolve(0);
        }
    });
}

// Función para mostrar notificaciones de sincronización
function showSyncNotification(title, message, isError = false) {
    let notificationElement = document.getElementById('syncNotification');
    
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'syncNotification';
        notificationElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px;
            border-radius: 5px;
            color: white;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: opacity 0.3s;
        `;
        document.body.appendChild(notificationElement);
    }
    
    notificationElement.textContent = `${title}: ${message}`;
    notificationElement.style.background = isError ? '#f44336' : '#4caf50';
    notificationElement.style.opacity = '1';
    
    setTimeout(() => {
        notificationElement.style.opacity = '0';
        setTimeout(() => {
            if (notificationElement.parentNode) {
                notificationElement.parentNode.removeChild(notificationElement);
            }
        }, 300);
    }, 5000);
}

// Manejar botones de suscripción
function toggleButtonsSuscripcion(permission) {
    const btnSuscribir = document.getElementById("btnSuscribir");
    const btnDesuscribir = document.getElementById("btnDesuscribir");
    
    if (!btnSuscribir || !btnDesuscribir) return;

    if (permission === "granted") {
        btnSuscribir.style.display = "none";
        btnDesuscribir.style.display = "block";
    } else {
        btnSuscribir.style.display = "block";
        btnDesuscribir.style.display = "none";
    }
}

// Validar estado online/offline
function validateOnline() {
    const updateOnlineStatus = () => {
        const status = document.getElementById('connectionStatus');
        const offlineIndicator = document.getElementById('offlineIndicator');
        
        if (navigator.onLine) {
            if (status) {
                status.textContent = '🟢 En línea';
                status.style.color = '#4caf50';
            }
            if (offlineIndicator) {
                offlineIndicator.style.display = 'none';
            }
            
            setTimeout(async () => {
                try {
                    const pendingCalifs = await checkPendingCalificaciones();
                    const pendingLibros = await checkPendingLibros();
                    
                    if (pendingCalifs > 0 || pendingLibros > 0) {
                        let message = '';
                        if (pendingCalifs > 0 && pendingLibros > 0) {
                            message = `${pendingCalifs} calificaciones y ${pendingLibros} libros pendientes se sincronizarán.`;
                        } else if (pendingCalifs > 0) {
                            message = `${pendingCalifs} calificaciones pendientes se sincronizarán.`;
                        } else {
                            message = `${pendingLibros} libros pendientes se sincronizarán.`;
                        }
                        
                        showSyncNotification("Volviendo online", message);
                        
                        if (pendingCalifs > 0) await forceSyncCalificaciones();
                        if (pendingLibros > 0) await forceSyncLibros();
                    }
                } catch (error) {
                    // Silencioso
                }
            }, 3000);
            
        } else {
            if (status) {
                status.textContent = '🔴 Offline';
                status.style.color = '#f44336';
            }
            if (offlineIndicator) {
                offlineIndicator.style.display = 'block';
            }
        }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus(); // Estado inicial
}

// Configurar notificaciones push
function setupPushNotifications() {
    const btnSuscribir = document.getElementById("btnSuscribir");
    const btnDesuscribir = document.getElementById("btnDesuscribir");

    if (!btnSuscribir || !btnDesuscribir) return;

    btnSuscribir.addEventListener("click", async function (event) {
        event.preventDefault();
        
        try {
            if (Notification.permission === "default") {
                const perm = await Notification.requestPermission();
                if (perm === "granted") {
                    await regWorker();
                    toggleButtonsSuscripcion("granted");
                    showSyncNotification("Notificaciones", "Permisos concedidos correctamente.");
                }
            } else if (Notification.permission === "granted") {
                await regWorker();
                showSyncNotification("Notificaciones", "Service Worker actualizado.");
            }
        } catch (err) {
            showSyncNotification("Error", "No se pudieron configurar las notificaciones.", true);
        }
    });

    btnDesuscribir.addEventListener("click", function (event) {
        event.preventDefault();
        showSyncNotification("Notificaciones", "Funcionalidad de desuscripción no implementada.");
    });

    toggleButtonsSuscripcion(Notification.permission);
}

// Función para debug del Service Worker
async function debugServiceWorker() {
    if (!navigator.serviceWorker.controller) {
        return;
    }

    const pendingCalifs = await checkPendingCalificaciones();
    const pendingLibros = await checkPendingLibros();
    
    // Enviar mensaje de debug al Service Worker
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = function(event) {
        if (event.data.type === 'CACHE_STATUS') {
            // Usar si necesitas logs
        }
    };

    navigator.serviceWorker.controller.postMessage({
        type: 'DEBUG_CACHE_STATUS'
    }, [messageChannel.port2]);
}

// Función para sincronización general (ambos tipos)
async function forceSyncAll() {
    try {
        const pendingCalifs = await checkPendingCalificaciones();
        const pendingLibros = await checkPendingLibros();
        
        if (pendingCalifs === 0 && pendingLibros === 0) {
            showSyncNotification("Sincronización", "No hay datos pendientes para sincronizar.");
            return;
        }
        
        showSyncNotification("Sincronización", `Sincronizando ${pendingCalifs} calificaciones y ${pendingLibros} libros...`);
        
        if (pendingCalifs > 0) await forceSyncCalificaciones();
        if (pendingLibros > 0) await forceSyncLibros();
        
    } catch (error) {
        showSyncNotification("Error", "No se pudo completar la sincronización.", true);
    }
}

// Función principal para inicializar PWA
async function initPWA() {
    if (!("serviceWorker" in navigator)) {
        return null;
    }

    try {
        const registration = await regWorker();
        
        setupPushNotifications();
        
        validateOnline();
        
        return registration;
    } catch (error) {
        return null;
    }
}

// Inicializar cuando se carga la página
window.addEventListener("load", function (event) {
    
    initPWA().then(registration => {
        if (registration) {
            setInterval(async () => {
                if (navigator.onLine) {
                    const pendingCalifs = await checkPendingCalificaciones();
                    const pendingLibros = await checkPendingLibros();
                    
                    if (pendingCalifs > 0 || pendingLibros > 0) {
                        // Log opcional
                    }
                }
            }, 30000); // Cada 30 segundos
            
            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data.type === 'syncCompleted') {
                    const { successful, failed, total, resource } = event.data;
                    const resourceName = resource === 'libros' ? 'libros' : 'calificaciones';
                    
                    if (successful > 0) {
                        showSyncNotification(
                            "Sincronización completada", 
                            `${successful} de ${total} ${resourceName} sincronizados.`
                        );
                    }
                    if (failed > 0) {
                        showSyncNotification(
                            "Sincronización con errores", 
                            `${failed} ${resourceName} no se pudieron sincronizar.`,
                            true
                        );
                    }
                }
            });
        }
    });
});

// Exportar funciones para uso global
if (typeof window !== 'undefined') {
    window.forceSyncCalificaciones = forceSyncCalificaciones;
    window.forceSyncLibros = forceSyncLibros;
    window.forceSyncAll = forceSyncAll;
    window.checkPendingCalificaciones = checkPendingCalificaciones;
    window.checkPendingLibros = checkPendingLibros;
    window.initPWA = initPWA;
    window.debugServiceWorker = debugServiceWorker;
    
    window.getPWAStatus = async function() {
        return {
            serviceWorker: !!navigator.serviceWorker?.controller,
            online: navigator.onLine,
            pendingCalificaciones: await checkPendingCalificaciones(),
            pendingLibros: await checkPendingLibros(),
            notificationPermission: Notification.permission
        };
    };
}

// Manejar errores no capturados
window.addEventListener('error', function(event) {
    // Silencioso
});

window.addEventListener('unhandledrejection', function(event) {
    // Silencioso
});