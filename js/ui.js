/**
 * ui.js
 * Contiene funciones para manipular la interfaz de usuario (DOM).
 * Actualiza la tabla, muestra mensajes, indicadores de carga, etc.
 */

// --- Selectores de Elementos del DOM (main.html) ---
const streamResultsBody = document.getElementById('streamResultsBody');
const loadingSpinner = document.getElementById('loadingSpinner');
const appMessageDiv = document.getElementById('appMessage');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const globalLastCheckTimeSpan = document.getElementById('globalLastCheckTime');
const noStreamsMessage = document.getElementById('noStreamsMessage');

/**
 * Limpia todas las filas de la tabla de resultados de streams.
 */
function clearStreamTable() {
    if (streamResultsBody) {
        streamResultsBody.innerHTML = '';
    }
    showNoStreamsMessage(true); // Mostrar mensaje de "no hay streams" por defecto después de limpiar
}

/**
 * Crea y devuelve un elemento badge para la plataforma.
 * @param {string} platform - Nombre de la plataforma (ej. 'youtube', 'facebook').
 * @returns {HTMLElement} El elemento span del badge.
 */
function createPlatformBadge(platform) {
    const badge = document.createElement('span');
    badge.classList.add('badge', 'platform-badge');
    const icon = document.createElement('i');
    icon.classList.add('bi', 'me-1');

    let platformText = platform.charAt(0).toUpperCase() + platform.slice(1);

    switch (platform.toLowerCase()) {
        case 'youtube':
            badge.classList.add('platform-youtube');
            icon.classList.add('bi-youtube');
            break;
        case 'facebook':
            badge.classList.add('platform-facebook');
            icon.classList.add('bi-facebook');
            break;
        case 'twitch': // Ejemplo si se añade
            badge.classList.add('platform-twitch');
            icon.classList.add('bi-twitch');
            break;
        default:
            badge.classList.add('platform-generic');
            icon.classList.add('bi-question-circle-fill');
            platformText = 'Desconocido';
    }
    badge.appendChild(icon);
    badge.appendChild(document.createTextNode(platformText));
    return badge;
}

/**
 * Crea y devuelve un elemento badge para el estado del stream.
 * @param {string} status - Estado del stream (ej. 'Live', 'Offline', 'Error').
 * @returns {HTMLElement} El elemento span del badge.
 */
function createStatusBadge(status) {
    const badge = document.createElement('span');
    badge.classList.add('badge', 'rounded-pill', 'status-badge');
    const icon = document.createElement('i');
    icon.classList.add('bi', 'me-1');

    let statusText = status;

    switch (status.toLowerCase()) {
        case 'live':
            badge.classList.add('status-live');
            icon.classList.add('bi-broadcast-pin');
            break;
        case 'offline':
            badge.classList.add('status-offline');
            icon.classList.add('bi-camera-video-off-fill');
            break;
        case 'error':
            badge.classList.add('status-error');
            icon.classList.add('bi-x-octagon-fill');
            break;
        default: // 'unknown' o cualquier otro
            badge.classList.add('status-unknown');
            icon.classList.add('bi-patch-question-fill');
            statusText = status || 'Desconocido'; // Si status es undefined o null
    }
    badge.appendChild(icon);
    badge.appendChild(document.createTextNode(statusText));
    return badge;
}


/**
 * Añade una fila a la tabla de streams con la información proporcionada.
 * @param {object} streamInfo - Objeto con la información del stream.
 * Ej: { platform: 'youtube', identifier: 'CanalX', name: 'Nombre del Canal X', status: 'Live', lastCheck: '10:30:00' }
 */
function addStreamToTable(streamInfo) {
    if (!streamResultsBody) return;

    showNoStreamsMessage(false); // Ocultar mensaje de "no hay streams" ya que estamos añadiendo uno

    const row = streamResultsBody.insertRow();
    // Usar un ID único para la fila, combinando plataforma e identificador para facilitar la actualización.
    // Asegúrate de que el identificador sea seguro para usar como parte de un ID de DOM.
    const safeIdentifier = (streamInfo.identifier || streamInfo.name || Date.now().toString()).replace(/[^a-zA-Z0-9-_]/g, '');
    row.id = `stream-${streamInfo.platform}-${safeIdentifier}`;

    const cellPlatform = row.insertCell();
    cellPlatform.appendChild(createPlatformBadge(streamInfo.platform || 'unknown'));

    const cellIdentifier = row.insertCell();
    cellIdentifier.textContent = streamInfo.name || streamInfo.identifier || 'N/A'; // Muestra el nombre si está disponible, sino el identificador

    const cellStatus = row.insertCell();
    cellStatus.appendChild(createStatusBadge(streamInfo.status || 'unknown'));

    const cellLastCheck = row.insertCell();
    cellLastCheck.textContent = streamInfo.lastCheck || new Date().toLocaleTimeString();
}

/**
 * Actualiza una fila existente en la tabla de streams.
 * Si la fila no existe, la crea.
 * @param {object} streamInfo - Objeto con la información actualizada del stream.
 */
function updateStreamRow(streamInfo) {
    if (!streamResultsBody) return;
    const safeIdentifier = (streamInfo.identifier || streamInfo.name || Date.now().toString()).replace(/[^a-zA-Z0-9-_]/g, '');
    const rowId = `stream-${streamInfo.platform}-${safeIdentifier}`;
    let row = document.getElementById(rowId);

    if (row) { // La fila existe, actualizar celdas
        // Celda de Plataforma (generalmente no cambia, pero por si acaso)
        row.cells[0].innerHTML = ''; // Limpiar
        row.cells[0].appendChild(createPlatformBadge(streamInfo.platform || 'unknown'));

        // Celda Identificador/Nombre
        row.cells[1].textContent = streamInfo.name || streamInfo.identifier || 'N/A';
        
        // Celda de Estado
        row.cells[2].innerHTML = ''; // Limpiar
        row.cells[2].appendChild(createStatusBadge(streamInfo.status || 'unknown'));
        
        // Celda Última Verificación
        row.cells[3].textContent = streamInfo.lastCheck || new Date().toLocaleTimeString();
    } else { // La fila no existe, añadirla
        addStreamToTable(streamInfo);
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
    appMessageDiv.classList.add(`alert-${type}`);
    
    // Añadir ícono según el tipo (opcional, pero mejora la UX)
    let iconClass = '';
    switch(type) {
        case 'success': iconClass = 'bi-check-circle-fill'; break;
        case 'info':    iconClass = 'bi-info-circle-fill'; break;
        case 'warning': iconClass = 'bi-exclamation-triangle-fill'; break;
        case 'danger':  iconClass = 'bi-x-octagon-fill'; break;
    }

    appMessageDiv.innerHTML = iconClass ? `<i class="bi ${iconClass} me-2"></i>${message}` : message;
    appMessageDiv.classList.remove('d-none');

    // Ocultar mensaje después de la duración especificada (si duration > 0)
    if (duration > 0) {
        setTimeout(() => {
            if (appMessageDiv) appMessageDiv.classList.add('d-none');
        }, duration);
    }
}

/**
 * Actualiza el texto que muestra el nombre del archivo seleccionado.
 * @param {string} fileName - El nombre del archivo. Si es null o vacío, muestra mensaje por defecto.
 */
function updateFileNameDisplay(fileName) {
    if (fileNameDisplay) {
        fileNameDisplay.textContent = fileName || 'Ningún archivo seleccionado';
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

// Inicializar la UI al cargar el script si es necesario (ej. asegurar que mensaje de "no streams" se muestre si la tabla está vacía)
document.addEventListener('DOMContentLoaded', () => {
    if (streamResultsBody && streamResultsBody.children.length === 0) {
        showNoStreamsMessage(true);
    }
});