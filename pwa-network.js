// Funciones de red y conexión para Librery
function reload(redir) {
    if (redir) {
        window.location.href = url(redir);
    } else {
        window.location.reload();
    }
}

async function unregWorker(redir, fun) {
    try {
        const reg = await navigator.serviceWorker.ready;
        
        const unregistered = await reg.unregister();
        
        if (unregistered) {
            
            if ("periodicSync" in reg) {
                try {
                    await reg.periodicSync.unregister(PERIODICSYNCEVENTNAME);
                } catch (syncError) {
                    // Silencioso
                }
            }
            
            try {
                await caches.delete(PRECACHENAME);
            } catch (cacheError) {
                // Silencioso
            }
            
            await clearLibreryOfflineData();
            
            if (typeof fun === "function") {
                fun();
            }
            
            if (redir) {
                setTimeout(() => reload(redir), 500);
            } else {
                setTimeout(() => reload(), 500);
            }
        }
    } catch (err) {
        if (redir) {
            reload(redir);
        } else {
            reload();
        }
    }
}

// Limpiar datos offline específicos de Librery
async function clearLibreryOfflineData() {
    try {
        Object.values(OFFLINE_CACHE_KEYS).forEach(key => {
            localStorage.removeItem(`cache_${key}`);
        });
        
        if (typeof clearAllLibreryCache === 'function') {
            await clearAllLibreryCache();
        }
        
        if ('indexedDB' in window) {
            const dbs = ['LibreryDB'];
            for (const dbName of dbs) {
                try {
                    await new Promise((resolve, reject) => {
                        const request = indexedDB.deleteDatabase(dbName);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                        request.onblocked = () => resolve(); // Ignorar si bloqueado
                    });
                } catch (dbError) {
                    // Silencioso
                }
            }
        }
    } catch (error) {
        // Silencioso
    }
}

function reinstall(redir) {
    setTabApp(defaultTabApp());

    if (redir) {
        setNextTabApp(defaultTabApp());
    }

    unregWorker(redir);
}

function validateOnline() {
    const elements = document.querySelectorAll(".online-required");
    elements.forEach(function (el) {
        if (navigator.onLine) {
            el.removeAttribute("disabled");
            el.classList.remove("disabled");
            el.classList.add("online");
        } else {
            el.setAttribute("disabled", "true");
            el.classList.add("disabled");
            el.classList.remove("online");
        }
    });
    
    updateLibreryConnectionStatus();
}

// Función específica para actualizar estado de conexión en Librery
function updateLibreryConnectionStatus() {
    const statusElements = document.querySelectorAll('.connection-status, .online-status');
    const offlineIndicators = document.querySelectorAll('.offline-indicator');
    
    if (navigator.onLine) {
        statusElements.forEach(el => {
            el.textContent = '🟢 En línea';
            el.style.color = '#4caf50';
            el.classList.remove('offline');
            el.classList.add('online');
        });
        offlineIndicators.forEach(el => {
            el.style.display = 'none';
        });
        
        setTimeout(async () => {
            try {
                if (typeof checkPendingCalificaciones === 'function' && typeof checkPendingLibros === 'function') {
                    const pendingCalifs = await checkPendingCalificaciones();
                    const pendingLibros = await checkPendingLibros();
                    
                    if (pendingCalifs > 0 || pendingLibros > 0) {
                        // Log opcional
                    }
                }
            } catch (error) {
                // Silencioso
            }
        }, 2000);
        
    } else {
        statusElements.forEach(el => {
            el.textContent = '🔴 Offline';
            el.style.color = '#f44336';
            el.classList.remove('online');
            el.classList.add('offline');
        });
        offlineIndicators.forEach(el => {
            el.style.display = 'block';
        });
    }
}

// Mostrar notificación toast
function toast(message, isError = false) {
    let toastElement = document.getElementById('globalToast');
    
    if (!toastElement) {
        toastElement = document.createElement('div');
        toastElement.id = 'globalToast';
        toastElement.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            background: ${isError ? '#f44336' : '#4caf50'};
            color: white;
            border-radius: 25px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
            max-width: 80%;
            text-align: center;
            font-weight: 500;
            font-size: 14px;
        `;
        document.body.appendChild(toastElement);
    }
    
    toastElement.textContent = message;
    toastElement.style.background = isError ? '#f44336' : '#4caf50';
    toastElement.style.opacity = '1';
    toastElement.style.bottom = '20px';
    
    setTimeout(() => {
        toastElement.style.opacity = '0';
        toastElement.style.bottom = '-100px';
        setTimeout(() => {
            if (toastElement.parentNode) {
                toastElement.parentNode.removeChild(toastElement);
            }
        }, 300);
    }, 3000);
}

// Verificar calidad de la conexión
async function checkConnectionQuality() {
    if (!navigator.onLine) {
        return { quality: 'offline', speed: 0 };
    }
    
    try {
        const startTime = performance.now();
        const response = await fetch('/?connection_test=' + Date.now(), {
            method: 'HEAD',
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        const endTime = performance.now();
        
        const latency = endTime - startTime;
        let quality = 'good';
        
        if (latency > 1000) quality = 'slow';
        else if (latency > 500) quality = 'medium';
        else if (latency > 200) quality = 'fast';
        else quality = 'excellent';
        
        return { quality, speed: latency };
    } catch (error) {
        return { quality: 'unknown', speed: 0 };
    }
}

// Función para verificar estado de la PWA
function getPWAStatus() {
    return {
        online: navigator.onLine,
        serviceWorker: !!navigator.serviceWorker?.controller,
        hasInstallPrompt: !!window.deferredPrompt,
        isStandalone: window.matchMedia('(display-mode: standalone)').matches || 
                     window.navigator.standalone === true
    };
}

// Función para instalar la PWA
async function installPWA() {
    if (window.deferredPrompt) {
        window.deferredPrompt.prompt();
        const { outcome } = await window.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            toast('Aplicación instalada correctamente');
        }
        
        window.deferredPrompt = null;
    } else {
        toast('La aplicación ya está instalada o no está disponible para instalación');
    }
}

// Manejar el evento beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    
    const installButton = document.getElementById('installButton');
    if (installButton) {
        installButton.style.display = 'block';
        installButton.addEventListener('click', installPWA);
    }
});

// Event listeners de conexión
window.addEventListener("online", function (event) {
    toast("Conexión restaurada ✅");
    validateOnline();
    
    setTimeout(async () => {
        const connection = await checkConnectionQuality();
        if (connection.quality === 'slow') {
            toast("Conexión lenta detectada ⚠️", true);
        }
        
        if (typeof forceSyncAll === 'function') {
            setTimeout(() => {
                forceSyncAll().catch(error => {
                    // Silencioso
                });
            }, 5000);
        }
    }, 1000);
});

window.addEventListener("offline", function (event) {
    toast("Sin conexión ❌", true);
    validateOnline();
});

// Inicializar validación de conexión al cargar
document.addEventListener('DOMContentLoaded', function() {
    validateOnline();
    
    const installButton = document.getElementById('installButton');
    if (installButton && window.deferredPrompt) {
        installButton.style.display = 'block';
        installButton.addEventListener('click', installPWA);
    } else if (installButton) {
        installButton.style.display = 'none';
    }
});

// Exportar funciones para uso global
if (typeof window !== 'undefined') {
    window.reload = reload;
    window.unregWorker = unregWorker;
    window.reinstall = reinstall;
    window.validateOnline = validateOnline;
    window.toast = toast;
    window.checkConnectionQuality = checkConnectionQuality;
    window.installPWA = installPWA;
    window.getPWAStatus = getPWAStatus;
}