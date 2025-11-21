// Inicializar IndexedDB para datos pendientes
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('LibreryDB', 5);
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('calificacionesPendientes')) {
                const store = db.createObjectStore('calificacionesPendientes', 
                    { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('librosPendientes')) {
                const store = db.createObjectStore('librosPendientes', 
                    { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('dataCache')) {
                db.createObjectStore('dataCache', { keyPath: 'key' });
            }
        };
        
        request.onsuccess = function(event) {
            resolve(event.target.result);
        };
        
        request.onerror = function(event) {
            reject(event.target.error);
        };
    });
}

// Guardar calificación pendiente en IndexedDB
async function savePendingCalificacion(calificacion) {
    const requiredFields = ['idLibro', 'calificacion', 'resena', 'action'];
    const missingFields = requiredFields.filter(field => !calificacion[field]);
    if (missingFields.length > 0) {
        throw new Error(`Campos requeridos faltantes: ${missingFields.join(', ')}`);
    }

    const db = await initDB();
    const transaction = db.transaction(['calificacionesPendientes'], 'readwrite');
    const store = transaction.objectStore('calificacionesPendientes');
    
    calificacion.timestamp = Date.now();
    calificacion.status = 'pending';
    
    return new Promise((resolve, reject) => {
        const request = store.put(calificacion); // Usar put para permitir actualización
        request.onsuccess = () => resolve(calificacion.id);
        request.onerror = () => reject(request.error);
    });
}

// Guardar libro pendiente en IndexedDB
async function savePendingLibro(libro) {
    const requiredFields = ['titulo', 'autor', 'fechaPublicacion', 'resena', 'action'];
    const missingFields = requiredFields.filter(field => !libro[field]);
    if (missingFields.length > 0) {
        throw new Error(`Campos requeridos faltantes: ${missingFields.join(', ')}`);
    }

    const db = await initDB();
    const transaction = db.transaction(['librosPendientes'], 'readwrite');
    const store = transaction.objectStore('librosPendientes');
    
    libro.timestamp = Date.now();
    libro.status = 'pending';
    
    return new Promise((resolve, reject) => {
        const request = store.put(libro); // Usar put para permitir actualización
        request.onsuccess = () => resolve(libro.id);
        request.onerror = () => reject(request.error);
    });
}

// Obtener calificaciones pendientes
async function getPendingCalificaciones() {
    const db = await initDB();
    const transaction = db.transaction(['calificacionesPendientes'], 'readonly');
    const store = transaction.objectStore('calificacionesPendientes');
    return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

// Obtener libros pendientes
async function getPendingLibros() {
    const db = await initDB();
    const transaction = db.transaction(['librosPendientes'], 'readonly');
    const store = transaction.objectStore('librosPendientes');
    return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

// Eliminar calificación pendiente
async function removePendingCalificacion(id) {
    const db = await initDB();
    const transaction = db.transaction(['calificacionesPendientes'], 'readwrite');
    const store = transaction.objectStore('calificacionesPendientes');
    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Eliminar libro pendiente
async function removePendingLibro(id) {
    const db = await initDB();
    const transaction = db.transaction(['librosPendientes'], 'readwrite');
    const store = transaction.objectStore('librosPendientes');
    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Guardar datos en cache (Cache API)
async function saveToCache(key, data) {
    try {
        const cache = await caches.open(PRECACHENAME);
        const response = new Response(JSON.stringify({
            data: data,
            timestamp: Date.now()
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
        await cache.put(`cache_${key}`, response);
    } catch (e) {
        console.warn('Error al guardar en Cache API:', e);
    }
}

// Obtener datos del cache (Cache API)
async function getFromCache(key) {
    try {
        const cache = await caches.open(PRECACHENAME);
        const cachedResponse = await cache.match(`cache_${key}`);
        if (cachedResponse) {
            const parsed = await cachedResponse.json();
            return parsed.data;
        }
    } catch (e) {
        console.warn('Error al obtener de Cache API:', e);
    }
    return null;
}

// Sincronizar calificaciones pendientes
async function syncPendingCalificaciones() {
    const pendingCalifs = await getPendingCalificaciones();
    if (pendingCalifs.length === 0) {
        return;
    }

    const syncPromises = pendingCalifs.map(calif => {
        const formData = new FormData();
        formData.append('action', calif.action || 'guardar');
        formData.append('idLibro', calif.idLibro);
        formData.append('calificacion', calif.calificacion);
        formData.append('resena', calif.resena);

        return fetch('gestionCalificaciones.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                return removePendingCalificacion(calif.id);
            }
            throw new Error('Error del servidor: ' + data.message);
        })
        .catch(error => {
            throw error;
        });
    });

    const results = await Promise.allSettled(syncPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({
                type: 'syncCompleted',
                successful: successful,
                failed: failed,
                total: pendingCalifs.length,
                resource: 'calificaciones'
            });
        });
    });
}

// Sincronizar libros pendientes
async function syncPendingLibros() {
    const pendingLibros = await getPendingLibros();
    if (pendingLibros.length === 0) {
        return;
    }

    const syncPromises = pendingLibros.map(libro => {
        const formData = new FormData();
        formData.append('action', libro.action || 'guardar');
        formData.append('db', libro.db || 'librocalif');
        formData.append('titulo', libro.titulo);
        formData.append('autor', libro.autor);
        formData.append('fechaPublicacion', libro.fechaPublicacion);
        formData.append('resena', libro.resena);

        return fetch('gestionLibros.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                return removePendingLibro(libro.id);
            }
            throw new Error('Error del servidor: ' + data.message);
        })
        .catch(error => {
            throw error;
        });
    });

    const results = await Promise.allSettled(syncPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({
                type: 'syncCompleted',
                successful: successful,
                failed: failed,
                total: pendingLibros.length,
                resource: 'libros'
            });
        });
    });
}

const PRECACHENAME = "librery-precache-v9";
const SYNCEVENTNAME = "librery-sync-notifications";
const PERIODICSYNCEVENTNAME = "librery-periodic-sync-notifications";
const CALIFICACIONES_SYNC = "calificaciones-sync";
const LIBROS_SYNC = "libros-sync";
const OFFLINEURL = "offline.html";

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(PRECACHENAME).then(function (cache) {
            const resourcesToCache = [
                './',
                'index.html',
                'admin-calificaciones.html',
                'admin-libros.html', 
                'admin-notifications.html',
                'offline.html',
                'manifest.json',
                'Libreria.ico',
                'Libreria.png',
                'Libreria-512x512.png',
                'maskable-icon.png',
                'pwa-constants.js',
                'pwa-installer.js',
                'pwa-network.js',
                'templatemo-3d-coverflow-scripts.js',
                'index.css',
                'calificaciones.css',
                'libros.css',
                'images/logo_libros.jpg',
                'images/libro1.jpg',
                'images/libro2.jpeg',
                'images/libro3.jpeg',
                'images/libro4.jpeg',
                'images/libro5.webp',
                'images/libro6.jpeg',
                'images/libro7.jpeg'
            ];

            const cachePromises = resourcesToCache.map(resource => {
                return cache.add(resource).catch(() => {
                    console.warn(`No se pudo cachear: ${resource}`);
                });
            });

            return Promise.allSettled(cachePromises).then(() => {
                return self.skipWaiting();
            });
        })
    );
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== PRECACHENAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

self.addEventListener("fetch", function (event) {
    const url = new URL(event.request.url);

    if (url.origin !== location.origin) {
        return;
    }

    // Manejo de solicitudes de navegación
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.status === 200 && response.headers.get('content-type')?.includes('text/html')) {
                        const responseClone = response.clone();
                        caches.open(PRECACHENAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            return caches.match(OFFLINEURL);
                        });
                })
        );
        return;
    }

    // Manejo de solicitudes GET para gestionCalificaciones.php y gestionLibros.php
    if (event.request.method === 'GET' && 
        (url.pathname.includes('gestionCalificaciones.php') || 
         url.pathname.includes('gestionLibros.php'))) {
        const action = url.searchParams.get('action');
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    const fetchPromise = fetch(event.request)
                        .then(networkResponse => {
                            if (networkResponse.ok) {
                                const responseClone = networkResponse.clone();
                                caches.open(PRECACHENAME).then(cache => {
                                    cache.put(event.request, responseClone);
                                });
                                if (action === 'lista' || action === 'lista_libros') {
                                    networkResponse.clone().json().then(data => {
                                        saveToCache(`api_${url.pathname}${url.search}`, data);
                                    });
                                }
                            }
                            return networkResponse;
                        })
                        .catch(() => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            return getFromCache(`api_${url.pathname}${url.search}`)
                                .then(cachedData => {
                                    if (cachedData) {
                                        return new Response(
                                            JSON.stringify(cachedData),
                                            { 
                                                headers: { 'Content-Type': 'application/json' },
                                                status: 200
                                            }
                                        );
                                    }
                                    return new Response(
                                        JSON.stringify({ 
                                            success: false, 
                                            message: "Sin conexión y no hay datos en cache",
                                            offline: true 
                                        }),
                                        { 
                                            headers: { 'Content-Type': 'application/json' },
                                            status: 503
                                        }
                                    );
                                });
                        });
                    return cachedResponse || fetchPromise;
                })
        );
        return;
    }

    // Manejo de solicitudes POST para gestionCalificaciones.php
    if (event.request.method === 'POST' && url.pathname.includes('gestionCalificaciones.php')) {
        event.respondWith(
            (async function() {
                if (navigator.onLine) {
                    return fetch(event.request);
                }
                try {
                    const clonedRequest = event.request.clone();
                    const formData = await clonedRequest.formData();
                    const calificacion = {
                        idLibro: formData.get('idLibro'),
                        calificacion: formData.get('calificacion'),
                        resena: formData.get('resena'),
                        action: formData.get('action') || 'guardar',
                        id: Date.now()
                    };

                    const missingFields = [];
                    if (!calificacion.idLibro) missingFields.push('idLibro');
                    if (!calificacion.calificacion) missingFields.push('calificacion');
                    if (!calificacion.resena) missingFields.push('resena');

                    if (missingFields.length > 0) {
                        return createErrorResponse(`Campos requeridos faltantes: ${missingFields.join(', ')}`);
                    }

                    await savePendingCalificacion(calificacion);

                    await self.registration.sync.register(CALIFICACIONES_SYNC);

                    return new Response(
                        JSON.stringify({
                            success: true,
                            message: "Calificación guardada localmente. Se sincronizará cuando haya conexión.",
                            offline: true,
                            localId: calificacion.id
                        }),
                        { 
                            headers: { 
                                'Content-Type': 'application/json',
                                'Cache-Control': 'no-cache'
                            },
                            status: 200
                        }
                    );
                } catch (error) {
                    console.error('Error al procesar calificación offline:', error);
                    return createErrorResponse(`Error al guardar calificación offline: ${error.message}`);
                }

                function createErrorResponse(message) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            message: message
                        }),
                        { 
                            headers: { 
                                'Content-Type': 'application/json',
                                'Cache-Control': 'no-cache'
                            },
                            status: 400
                        }
                    );
                }
            })()
        );
        return;
    }

    // Manejo de solicitudes POST para gestionLibros.php
    if (event.request.method === 'POST' && url.pathname.includes('gestionLibros.php')) {
        event.respondWith(
            (async function() {
                if (navigator.onLine) {
                    return fetch(event.request);
                }
                try {
                    const clonedRequest = event.request.clone();
                    const formData = await clonedRequest.formData();
                    const libro = {
                        titulo: formData.get('titulo'),
                        autor: formData.get('autor'),
                        fechaPublicacion: formData.get('fechaPublicacion'),
                        resena: formData.get('resena'),
                        action: formData.get('action') || 'guardar',
                        db: formData.get('db') || 'librocalif',
                        id: Date.now()
                    };

                    const missingFields = [];
                    if (!libro.titulo) missingFields.push('titulo');
                    if (!libro.autor) missingFields.push('autor');
                    if (!libro.fechaPublicacion) missingFields.push('fechaPublicacion');
                    if (!libro.resena) missingFields.push('resena');

                    if (missingFields.length > 0) {
                        return createErrorResponse(`Campos requeridos faltantes: ${missingFields.join(', ')}`);
                    }

                    await savePendingLibro(libro);

                    await self.registration.sync.register(LIBROS_SYNC);

                    return new Response(
                        JSON.stringify({
                            success: true,
                            message: "Libro guardado localmente. Se sincronizará cuando haya conexión. Nota: La imagen no se guardará offline y deberá subirse nuevamente.",
                            offline: true,
                            localId: libro.id
                        }),
                        { 
                            headers: { 
                                'Content-Type': 'application/json',
                                'Cache-Control': 'no-cache'
                            },
                            status: 200
                        }
                    );
                } catch (error) {
                    console.error('Error al procesar libro offline:', error);
                    return createErrorResponse(`Error al guardar libro offline: ${error.message}`);
                }

                function createErrorResponse(message) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            message: message
                        }),
                        { 
                            headers: { 
                                'Content-Type': 'application/json',
                                'Cache-Control': 'no-cache'
                            },
                            status: 400
                        }
                    );
                }
            })()
        );
        return;
    }

    // Manejo de otros recursos GET
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(event.request)
                        .then(networkResponse => {
                            if (networkResponse && networkResponse.status === 200) {
                                const responseClone = networkResponse.clone();
                                caches.open(PRECACHENAME)
                                    .then(cache => cache.put(event.request, responseClone));
                            }
                            return networkResponse;
                        })
                        .catch(() => {
                            return new Response('Recurso no disponible offline', {
                                status: 408,
                                statusText: 'Offline'
                            });
                        });
                })
        );
    }
});

self.addEventListener("sync", function (event) {
    if (event.tag === SYNCEVENTNAME) {
        event.waitUntil(syncNotifications(self.registration));
    } else if (event.tag === CALIFICACIONES_SYNC) {
        event.waitUntil(syncPendingCalificaciones());
    } else if (event.tag === LIBROS_SYNC) {
        event.waitUntil(syncPendingLibros());
    }
});

self.addEventListener("periodicsync", function (event) {
    if (event.tag === PERIODICSYNCEVENTNAME) {
        event.waitUntil(periodicSyncNotifications(self.registration));
    }
});

self.addEventListener("push", function (event) {
    const data = event.data ? event.data.json() : {};

    const title = data.title || "Notificación";
    const options = {
        body: data.body || "Tienes una nueva notificación",
        icon: data.icon || "Libreria-512x512.png",
        image: data.image,
        badge: "Libreria-512x512.png"
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener("notificationclick", function(event) {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow("/")
    );
});

self.addEventListener('message', function(event) {
    if (event.data.type === 'GET_PENDING_CALIFICACIONES') {
        getPendingCalificaciones().then(califs => {
            event.ports[0].postMessage({
                type: 'PENDING_CALIFICACIONES',
                data: califs
            });
        });
    }
    
    if (event.data.type === 'GET_PENDING_LIBROS') {
        getPendingLibros().then(libros => {
            event.ports[0].postMessage({
                type: 'PENDING_LIBROS',
                data: libros
            });
        });
    }
    
    if (event.data.type === 'GET_PENDING_CALIFICACIONES_COUNT') {
        getPendingCalificaciones().then(califs => {
            event.ports[0].postMessage({
                type: 'PENDING_CALIFICACIONES_COUNT',
                count: califs.length
            });
        });
    }
    
    if (event.data.type === 'GET_PENDING_LIBROS_COUNT') {
        getPendingLibros().then(libros => {
            event.ports[0].postMessage({
                type: 'PENDING_LIBROS_COUNT',
                count: libros.length
            });
        });
    }
});

// Placeholders para sync notifications
function syncNotifications(reg) {
    // Implementar lógica real si se usa
}

function periodicSyncNotifications(reg) {
    // Implementar lógica real si se usa
}