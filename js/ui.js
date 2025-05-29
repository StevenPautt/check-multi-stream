// js/ui.js

/**
 * Contiene funciones para manipular la interfaz de usuario (DOM).
 * Actualiza la tabla, muestra mensajes, indicadores de carga, etc.
 */

// --- Selectores de Elementos del DOM (main.html) ---
const streamResultsBody = document.getElementById('streamResultsBody');
const loadingSpinner = document.getElementById('loadingSpinner');
const appMessageDiv = document.getElementById('appMessage');
// const fileNameDisplay = document.getElementById('fileNameDisplay'); // Ya no se usa si cambiaste a textarea
const globalLastCheckTimeSpan = document.getElementById('globalLastCheckTime');
const noStreamsMessage = document.getElementById('noStreamsMessage');

/**
 * Limpia todas las filas de la tabla de resultados de streams.
 */
function clearStreamTable() {
    if (streamResultsBody) {
        streamResultsBody.innerHTML = '';
    }
    // No mostramos "no streams" aquí, se maneja después de intentar añadir filas
}

/**
 * Crea y devuelve un elemento badge para la plataforma.
 * @param {string} platform - Nombre de la plataforma (ej. 'youtube', 'facebook').
 * @returns {HTMLElement} El elemento span del badge.
 */
function createPlatformBadge(platform) {
    const badge = document.createElement('span');
    badge.classList.add('badge', 'platform-badge'); // Clases de Bootstrap y personalizadas
    const icon = document.createElement('i');
    icon.classList.add('bi', 'me-1'); // Iconos de Bootstrap

    let platformText = platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Desconocido';

    switch (platform ? platform.toLowerCase() : 'unknown') {
        case 'youtube':
            badge.classList.add('platform-youtube'); // De style.css
            icon.classList.add('bi-youtube');
            break;
        case 'facebook':
            badge.classList.add('platform-facebook'); // De style.css
            icon.classList.add('bi-facebook');
            break;
        case 'twitch':
            badge.classList.add('platform-twitch'); // De style.css
            icon.classList.add('bi-twitch');
            break;
        case 'kick':
            badge.classList.add('platform-kick'); // De style.css
            // Kick no tiene un ícono obvio en Bootstrap Icons, puedes usar uno genérico o añadir FontAwesome
            icon.classList.add('bi-play-circle-fill'); // Ejemplo
            break;
        default:
            badge.classList.add('platform-generic'); // De style.css
            icon.classList.add('bi-question-circle-fill');
            platformText = 'Desconocido';
    }
    badge.appendChild(icon);
    badge.appendChild(document.createTextNode(platformText));
    return badge;
}

/**
 * Crea y devuelve un elemento badge para el estado del stream.
 * @param {string} status - Estado del stream (ej. 'Live', 'Offline', 'Error', 'Pendiente...').
 * @returns {HTMLElement} El elemento span del badge.
 */
function createStatusBadge(status) {
    const badge = document.createElement('span');
    badge.classList.add('badge', 'rounded-pill', 'status-badge'); // Clases de Bootstrap y personalizadas
    const icon = document.createElement('i');
    icon.classList.add('bi', 'me-1'); // Iconos de Bootstrap

    let statusText = status || 'Desconocido';

    switch (status ? status.toLowerCase() : 'unknown') {
        case 'live':
            badge.classList.add('status-live'); // De style.css
            icon.classList.add('bi-broadcast-pin');
            break;
        case 'offline':
            badge.classList.add('status-offline'); // De style.css
            icon.classList.add('bi-camera-video-off-fill');
            break;
        case 'error':
        case 'error config.': // Para manejar "Error Config." también
        case 'error api':
            badge.classList.add('status-error'); // De style.css
            icon.classList.add('bi-x-octagon-fill');
            break;
        case 'no soportado':
            badge.classList.add('status-unknown'); // Reutilizar estilo 'unknown' o crear 'unsupported'
            icon.classList.add('bi-slash-circle-fill');
            break;
        case 'pendiente...':
            badge.classList.add('status-pending'); // Necesitarías un estilo para 'status-pending' en style.css
            icon.classList.add('bi-hourglass-split');
            statusText = 'Pendiente'; // Acortar para el badge
            break;
        default: 
            badge.classList.add('status-unknown'); // De style.css
            icon.classList.add('bi-patch-question-fill');
    }
    badge.appendChild(icon);
    badge.appendChild(document.createTextNode(statusText));
    return badge;
}


/**
 * Añade una fila a la tabla de streams con la información proporcionada.
 * @param {object} streamInfo - Objeto con la información del stream.
 * Debe tener: originalInput (para ID de fila), platform, name (para mostrar), status, lastCheck.
 */
function addStreamToTable(streamInfo) {
    if (!streamResultsBody) return;

    if (typeof showNoStreamsMessage === 'function') showNoStreamsMessage(false);

    const row = streamResultsBody.insertRow();
    // Usar originalInput para un ID de fila estable y único.
    // Sanitizar originalInput para que sea un ID HTML válido.
    const stableRowKey = (streamInfo.originalInput || `stream-${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9-_]/g, '');
    row.id = `stream-${streamInfo.platform}-${stableRowKey}`;

    const cellPlatform = row.insertCell();
    cellPlatform.appendChild(createPlatformBadge(streamInfo.platform));

    const cellNameIdentifier = row.insertCell();
    cellNameIdentifier.textContent = streamInfo.name || streamInfo.originalInput || 'N/A';
    // Opcional: añadir el identificador de API si es diferente y útil
    // if (streamInfo.identifier && streamInfo.identifier !== streamInfo.name) {
    //    const idSpan = document.createElement('small');
    //    idSpan.className = 'text-muted d-block';
    //    idSpan.textContent = `(${streamInfo.identifier})`;
    //    cellNameIdentifier.appendChild(idSpan);
    // }


    const cellStatus = row.insertCell();
    cellStatus.appendChild(createStatusBadge(streamInfo.status));

    const cellLastCheck = row.insertCell();
    cellLastCheck.textContent = streamInfo.lastCheck || new Date().toLocaleTimeString();
}

/**
 * Actualiza una fila existente en la tabla de streams.
 * @param {object} streamInfo - Objeto con la información actualizada del stream.
 */
function updateStreamRow(streamInfo) {
    if (!streamResultsBody) return;

    const stableRowKey = (streamInfo.originalInput || `stream-${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9-_]/g, '');
    const rowId = `stream-${streamInfo.platform}-${stableRowKey}`;
    let row = document.getElementById(rowId);

    if (row) { // La fila existe, actualizar celdas
        // La plataforma usualmente no cambia, pero el nombre sí puede.
        // Celda 0: Plataforma (si el originalInput o platform pudieran cambiar y afectar el ID)
        // Si la plataforma pudiera cambiar para un mismo originalInput, necesitaríamos un ID aún más estable.
        // Por ahora asumimos que originalInput es la clave única para la *intención* del usuario.

        // Celda 1: Nombre/Identificador
        row.cells[1].textContent = streamInfo.name || streamInfo.originalInput || 'N/A';
        // Opcional: añadir el identificador de API
        // if (row.cells[1].querySelector('small')) row.cells[1].querySelector('small').remove(); // Limpiar ID anterior
        // if (streamInfo.identifier && streamInfo.identifier !== streamInfo.name) {
        //    const idSpan = document.createElement('small');
        //    idSpan.className = 'text-muted d-block';
        //    idSpan.textContent = `(${streamInfo.identifier})`;
        //    row.cells[1].appendChild(idSpan);
        // }
        
        // Celda 2: Estado
        row.cells[2].innerHTML = ''; // Limpiar para poner el nuevo badge
        row.cells[2].appendChild(createStatusBadge(streamInfo.status));
        
        // Celda 3: Última Verificación
        row.cells[3].textContent = streamInfo.lastCheck || new Date().toLocaleTimeString();
    } else { 
        console.warn(`ui.js: No se encontró la fila con ID ${rowId} para actualizar. Creando nueva fila (esto no debería pasar si originalInput es estable).`);
        addStreamToTable(streamInfo); // Fallback, pero idealmente no se llega aquí
    }
}

/**
 * Muestra u oculta el indicador de carga (spinner).
 * @param {boolean} isLoading - True para mostrar el spinner, false para ocultarlo.
 */
function showLoadingIndicator(isLoading) {
    if (loadingSpinner) {
        loadingSpinner.classList.toggle('d-none', !isLoading);
    }
}

/**
 * Muestra un mensaje al usuario en el área de mensajes de la aplicación.
 * @param {string} message - El mensaje a mostrar.
 * @param {string} type - El tipo de mensaje ('info', 'success', 'warning', 'danger'). Por defecto 'info'.
 * @param {number} duration - Duración en milisegundos antes de que el mensaje desaparezca. 0 para persistente.
 */
function showAppMessage(message, type = 'info', duration = 5000) {
    if (!appMessageDiv) return;

    appMessageDiv.className = 'alert'; // Resetear clases
    appMessageDiv.classList.add(`alert-${type}`, 'alert-dismissible', 'fade', 'show'); // Clases Bootstrap para alerta con cierre
    
    let iconClass = '';
    switch(type) {
        case 'success': iconClass = 'bi-check-circle-fill'; break;
        case 'info':    iconClass = 'bi-info-circle-fill'; break;
        case 'warning': iconClass = 'bi-exclamation-triangle-fill'; break;
        case 'danger':  iconClass = 'bi-x-octagon-fill'; break;
    }

    appMessageDiv.innerHTML = `
        ${iconClass ? `<i class="bi ${iconClass} me-2"></i>` : ''}
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `; // Añadido botón de cierre de Bootstrap
    appMessageDiv.classList.remove('d-none');

    if (duration > 0) {
        setTimeout(() => {
            // Usar Bootstrap para cerrar la alerta si existe
            const alertInstance = bootstrap.Alert.getInstance(appMessageDiv);
            if (alertInstance) {
                alertInstance.close();
            } else {
                // Fallback si no se puede obtener instancia (raro)
                appMessageDiv.classList.add('d-none');
                appMessageDiv.classList.remove('show');
            }
        }, duration);
    }
}


/**
 * Actualiza el texto de la "Última Verificación Global".
 * @param {string} timeString - La cadena de tiempo a mostrar.
 */
function updateGlobalLastCheckTime(timeString) {
    if (globalLastCheckTimeSpan) {
        globalLastCheckTimeSpan.textContent = timeString || '-';
    }
}

/**
 * Muestra u oculta el mensaje de "No hay streams para mostrar".
 * @param {boolean} show - True para mostrar el mensaje, false para ocultarlo.
 */
function showNoStreamsMessage(show) {
    if (noStreamsMessage) {
        noStreamsMessage.classList.toggle('d-none', !show);
    }
}

// Inicializar la UI al cargar el script si es necesario
document.addEventListener('DOMContentLoaded', () => {
    if (streamResultsBody && streamResultsBody.children.length === 0) {
        if (typeof showNoStreamsMessage === 'function') {
            showNoStreamsMessage(true);
        }
    }
});