// js/ui.js

/**
 * Contiene funciones para manipular la interfaz de usuario (DOM).
 * Actualiza la tabla, muestra mensajes, indicadores de carga, etc.
 */

const streamResultsBody = document.getElementById('streamResultsBody');
const loadingSpinner = document.getElementById('loadingSpinner');
const appMessageDiv = document.getElementById('appMessage');
const globalLastCheckTimeSpan = document.getElementById('globalLastCheckTime');
const noStreamsMessage = document.getElementById('noStreamsMessage');

function clearStreamTable() {
    if (streamResultsBody) {
        streamResultsBody.innerHTML = '';
    }
    // No mostramos "no streams" aquí automáticamente, displayStreamsInTable lo hará.
}

function createPlatformBadge(platform) {
    const badge = document.createElement('span');
    badge.classList.add('badge', 'platform-badge'); 
    const icon = document.createElement('i');
    icon.classList.add('bi', 'me-1'); 
    let platformText = platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Desconocido';

    switch (platform ? platform.toLowerCase() : 'unknown') {
        case 'youtube':
            badge.classList.add('platform-youtube'); icon.classList.add('bi-youtube'); break;
        case 'facebook':
            badge.classList.add('platform-facebook'); icon.classList.add('bi-facebook'); break;
        case 'twitch':
            badge.classList.add('platform-twitch'); icon.classList.add('bi-twitch'); break;
        case 'kick':
            badge.classList.add('platform-kick'); icon.classList.add('bi-play-circle-fill'); break; 
        default:
            badge.classList.add('platform-generic'); icon.classList.add('bi-question-circle-fill'); platformText = 'Desconocido';
    }
    badge.appendChild(icon);
    badge.appendChild(document.createTextNode(platformText));
    return badge;
}

function createStatusBadge(status) {
    const badge = document.createElement('span');
    badge.classList.add('badge', 'rounded-pill', 'status-badge'); 
    const icon = document.createElement('i');
    icon.classList.add('bi', 'me-1'); 
    let statusText = status || 'Desconocido';

    switch (status ? status.toLowerCase() : 'unknown') {
        case 'live':
            badge.classList.add('status-live'); icon.classList.add('bi-broadcast-pin'); break;
        case 'offline':
            badge.classList.add('status-offline'); icon.classList.add('bi-camera-video-off-fill'); break;
        case 'error': case 'error config.': case 'error api': 
            badge.classList.add('status-error'); icon.classList.add('bi-x-octagon-fill'); break;
        case 'no soportado':
            badge.classList.add('status-unknown'); icon.classList.add('bi-slash-circle-fill'); break;
        case 'pendiente...':
            badge.classList.add('status-pending'); icon.classList.add('bi-hourglass-split'); statusText = 'Pendiente'; break;
        default:
            badge.classList.add('status-unknown'); icon.classList.add('bi-patch-question-fill');
    }
    badge.appendChild(icon);
    badge.appendChild(document.createTextNode(statusText));
    return badge;
}

function addStreamToTable(streamInfo) { // Esta función ahora solo añade una fila
    if (!streamResultsBody) return;

    const row = streamResultsBody.insertRow();
    const stableRowKey = (streamInfo.originalInput || `stream-${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9-_]/g, '');
    row.id = `stream-${streamInfo.platform}-${stableRowKey}`;

    const cellPlatform = row.insertCell();
    cellPlatform.appendChild(createPlatformBadge(streamInfo.platform));
    cellPlatform.classList.add('platform-col');

    const cellNameIdentifier = row.insertCell();
    cellNameIdentifier.classList.add('name-identifier-col');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'channel-name'; 
    nameSpan.textContent = streamInfo.name || streamInfo.originalInput || 'N/A';
    cellNameIdentifier.appendChild(nameSpan);

    if (streamInfo.identifier && 
        (streamInfo.identifier.startsWith('UC') || streamInfo.identifier.startsWith('HC')) && 
        streamInfo.identifier !== streamInfo.name && 
        streamInfo.identifier !== streamInfo.originalInput) {
       const idSpan = document.createElement('span');
       idSpan.className = 'channel-id d-block'; 
       idSpan.textContent = `(${streamInfo.identifier})`; 
       cellNameIdentifier.appendChild(idSpan);
    }

    const cellStatus = row.insertCell();
    cellStatus.appendChild(createStatusBadge(streamInfo.status));
    cellStatus.classList.add('status-col');

    const cellTitle = row.insertCell();
    cellTitle.textContent = streamInfo.title || '-';
    cellTitle.title = streamInfo.title || ''; 
    cellTitle.classList.add('stream-title-col'); 

    const cellViewers = row.insertCell();
    cellViewers.textContent = (typeof streamInfo.viewers === 'number') ? streamInfo.viewers.toLocaleString() : '-';
    cellViewers.classList.add('viewers-col'); 

    const cellLastCheck = row.insertCell();
    cellLastCheck.textContent = streamInfo.lastCheck || new Date().toLocaleTimeString();
    cellLastCheck.classList.add('last-check-col');
}

function updateStreamRow(streamInfo) { // Esta función ahora solo actualiza una fila existente
    if (!streamResultsBody) return;
    const stableRowKey = (streamInfo.originalInput || `stream-${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9-_]/g, '');
    const rowId = `stream-${streamInfo.platform}-${stableRowKey}`;
    let row = document.getElementById(rowId);

    if (row) {
        const cellNameIdentifier = row.cells[1];
        cellNameIdentifier.innerHTML = ''; 
        const nameSpan = document.createElement('span');
        nameSpan.className = 'channel-name';
        nameSpan.textContent = streamInfo.name || streamInfo.originalInput || 'N/A';
        cellNameIdentifier.appendChild(nameSpan);

        if (streamInfo.identifier && 
            (streamInfo.identifier.startsWith('UC') || streamInfo.identifier.startsWith('HC')) && 
            streamInfo.identifier !== streamInfo.name && 
            streamInfo.identifier !== streamInfo.originalInput) {
           const idSpan = document.createElement('span');
           idSpan.className = 'channel-id d-block';
           idSpan.textContent = `(${streamInfo.identifier})`;
           cellNameIdentifier.appendChild(idSpan);
        }
        
        row.cells[2].innerHTML = ''; 
        row.cells[2].appendChild(createStatusBadge(streamInfo.status));
        row.cells[3].textContent = streamInfo.title || '-';
        row.cells[3].title = streamInfo.title || '';
        row.cells[4].textContent = (typeof streamInfo.viewers === 'number') ? streamInfo.viewers.toLocaleString() : '-';
        row.cells[5].textContent = streamInfo.lastCheck || new Date().toLocaleTimeString();
    } else { 
        console.warn(`ui.js: No se encontró la fila con ID ${rowId} para actualizar. Se creará una nueva (esto indica un problema si la fila ya debería existir).`);
        addStreamToTable(streamInfo); 
    }
}

/**
 * Limpia la tabla y la repuebla con los streams proporcionados.
 * @param {Array<object>} streamsToDisplay - Array de objetos streamInfo para mostrar.
 */
function displayStreamsInTable(streamsToDisplay) {
    if (!streamResultsBody) return;
    clearStreamTable(); 

    if (streamsToDisplay && streamsToDisplay.length > 0) {
        showNoStreamsMessage(false);
        streamsToDisplay.forEach(streamInfo => {
            addStreamToTable(streamInfo); 
        });
    } else {
        showNoStreamsMessage(true);
    }
}


function showLoadingIndicator(isLoading) {
    if (loadingSpinner) {
        loadingSpinner.classList.toggle('d-none', !isLoading);
    }
}

function showAppMessage(message, type = 'info', duration = 5000) {
    // ... (sin cambios respecto a la versión anterior con botón de cierre) ...
    if (!appMessageDiv) return;
    appMessageDiv.className = 'alert alert-dismissible fade show'; 
    appMessageDiv.classList.add(`alert-${type}`);
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
    `;
    appMessageDiv.classList.remove('d-none');

    if (duration > 0) {
        setTimeout(() => {
            const existingAlertInstance = bootstrap.Alert.getInstance(appMessageDiv);
            if (existingAlertInstance) {
                existingAlertInstance.close();
            } else {
                appMessageDiv.classList.add('d-none');
                appMessageDiv.classList.remove('show');
            }
        }, duration);
    }
}

function updateGlobalLastCheckTime(timeString) {
    if (globalLastCheckTimeSpan) {
        globalLastCheckTimeSpan.textContent = timeString || '-';
    }
}

function showNoStreamsMessage(show) {
    if (noStreamsMessage) {
        noStreamsMessage.classList.toggle('d-none', !show);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (streamResultsBody && streamResultsBody.children.length === 0) {
        if (typeof showNoStreamsMessage === 'function') {
            showNoStreamsMessage(true);
        }
    }
});