// Constantes para Librery PWA
function url(file) {
    // Para desarrollo y producción
    if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
        return file || '';
    }
    return new URL(file || '', self.location).href;
}

function defaultTabApp() {
    return "tab-inicio";
}

function setTabApp(tabapp) {
    localStorage.setItem(TABAPPNAME, tabapp || defaultTabApp());
}

function getTabApp() {
    return localStorage.getItem(TABAPPNAME) || defaultTabApp();
}

function removeTabApp() {
    localStorage.removeItem(TABAPPNAME);
}

function defaultNextTabApp() {
    return "tab-calificaciones";
}

function setNextTabApp(tabapp) {
    localStorage.setItem(NEXTTABAPPNAME, tabapp || defaultNextTabApp());
}

function getNextTabApp() {
    return localStorage.getItem(NEXTTABAPPNAME) || defaultNextTabApp();
}

function removeNextTabApp() {
    localStorage.removeItem(NEXTTABAPPNAME);
}

// CONSTANTES PARA LIBRERY - SIN EXPIRACIÓN DE CACHE
var PRECACHENAME = "librery-precache-v8";
var SYNCEVENTNAME = "librery-sync-notifications";
var PERIODICSYNCEVENTNAME = "librery-periodic-sync-notifications";
var CALIFICACIONES_SYNC = "calificaciones-sync";
var LIBROS_SYNC = "libros-sync";
var TABAPPNAME = "librery-tab";
var NEXTTABAPPNAME = "librery-next-tab";
var OFFLINEURL = "offline.html";

// Constantes para gestión de datos offline - SIN EXPIRACIÓN
var OFFLINE_CACHE_KEYS = {
    LIBROS: 'cache_libros',
    CALIFICACIONES: 'cache_calificaciones',
    CONFIG: 'cache_config'
};

// Tiempos de expiración de cache DESACTIVADOS (siempre válido)
var CACHE_EXPIRATION = {
    SHORT: null, // No expira
    MEDIUM: null, // No expira  
    LONG: null // No expira
};

// Función para guardar en cache sin timestamp de expiración
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

// Función para leer del cache (siempre válido)
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

// Función para limpiar cache específico
function clearCache(key) {
    return new Promise((resolve) => {
        try {
            localStorage.removeItem(`cache_${key}`);
            resolve();
        } catch (e) {
            resolve();
        }
    });
}

// Función para limpiar todo el cache de Librery
function clearAllLibreryCache() {
    return new Promise((resolve) => {
        try {
            Object.values(OFFLINE_CACHE_KEYS).forEach(key => {
                localStorage.removeItem(`cache_${key}`);
            });
            resolve();
        } catch (e) {
            resolve();
        }
    });
}