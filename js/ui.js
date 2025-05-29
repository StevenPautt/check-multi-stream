// js/ui.js

const streamResultsBody = document.getElementById('streamResultsBody');
const loadingSpinner = document.getElementById('loadingSpinner');
const appMessageDiv = document.getElementById('appMessage');
const globalLastCheckTimeSpan = document.getElementById('globalLastCheckTime');
const noStreamsMessage = document.getElementById('noStreamsMessage');
const apiKeyStatusSpan = document.getElementById('apiKeyStatus');
const youtubeQuotaStatusSpan = document.getElementById('youtubeQuotaStatus');

function clearStreamTable() {
    if (streamResultsBody) {
        streamResultsBody.innerHTML = '';
    }
}

function createPlatformBadge(platform) {
    const badge = document.createElement('span');
    badge.classList.add('badge', 'platform-badge');
    const icon = document.createElement('i');
    icon.classList.add('bi', 'me-1');
    let platformText = platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Unknown';

    switch (platform ? platform.toLowerCase() : 'unknown') {
        case 'youtube': badge.classList.add('platform-youtube'); icon.classList.add('bi-youtube'); break;
        case 'facebook': badge.classList.add('platform-facebook'); icon.classList.add('bi-facebook'); break;
        case 'twitch': badge.classList.add('platform-twitch'); icon.classList.add('bi-twitch'); break;
        case 'kick': badge.classList.add('platform-kick'); icon.classList.add('bi-play-circle-fill'); break;
        default: badge.classList.add('platform-generic'); icon.classList.add('bi-question-circle-fill'); platformText = 'Unknown';
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
    let statusText = status || 'Unknown';

    switch (status ? status.toLowerCase() : 'unknown') {
        case 'live': badge.classList.add('status-live'); icon.classList.add('bi-broadcast-pin'); break;
        case 'offline': badge.classList.add('status-offline'); icon.classList.add('bi-camera-video-off-fill'); break;
        case 'error': case 'error config.': case 'api error': case 'config error':
            badge.classList.add('status-error'); icon.classList.add('bi-x-octagon-fill'); statusText = 'Error'; break;
        case 'unsupported':
            badge.classList.add('status-unknown'); icon.classList.add('bi-slash-circle-fill'); statusText = 'Unsupported'; break;
        case 'pending...':
            badge.classList.add('status-pending'); icon.classList.add('bi-hourglass-split'); statusText = 'Pending'; break;
        default: badge.classList.add('status-unknown'); icon.classList.add('bi-patch-question-fill');
    }
    badge.appendChild(icon);
    badge.appendChild(document.createTextNode(statusText));
    return badge;
}

function addStreamToTable(streamInfo) {
    if (!streamResultsBody) return;
    if (typeof showNoStreamsMessage === 'function') showNoStreamsMessage(false);

    const row = streamResultsBody.insertRow();
    const stableRowKey = (streamInfo.originalInput || `stream-${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9-_]/g, '');
    row.id = `stream-row-${stableRowKey}`; 

    const cellPlatform = row.insertCell(); // Celda 0
    cellPlatform.appendChild(createPlatformBadge(streamInfo.platform));
    cellPlatform.classList.add('platform-col');

    const cellNameIdentifier = row.insertCell(); // Celda 1
    cellNameIdentifier.classList.add('name-identifier-col');
    const link = document.createElement('a');
    const urlToLink = streamInfo.originalInput; 
    link.href = (urlToLink && (urlToLink.toLowerCase().startsWith('http://') || urlToLink.toLowerCase().startsWith('https://'))) 
                ? urlToLink : '#'; 
    if (link.href === '#') { 
        const lowerPlatform = streamInfo.platform ? streamInfo.platform.toLowerCase() : '';
        const identifierForLinkFallback = streamInfo.identifier || streamInfo.originalInput;
        if (lowerPlatform === 'twitch') link.href = `https://twitch.tv/${identifierForLinkFallback}`;
        else if (lowerPlatform === 'kick') link.href = `https://kick.com/${identifierForLinkFallback}`;
    }
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'channel-link';
    const nicknameSpan = document.createElement('span');
    nicknameSpan.className = 'channel-nickname d-block';
    nicknameSpan.textContent = streamInfo.nickname || streamInfo.name || streamInfo.originalInput || 'N/A';
    link.appendChild(nicknameSpan);
    cellNameIdentifier.appendChild(link);
    if (streamInfo.name && streamInfo.name !== (streamInfo.nickname || streamInfo.originalInput)) {
       const officialNameSpan = document.createElement('span');
       officialNameSpan.className = 'channel-official-name d-block text-muted';
       officialNameSpan.textContent = `(${streamInfo.name})`; 
       cellNameIdentifier.appendChild(officialNameSpan);
    }

    const cellStatus = row.insertCell(); // Celda 2
    cellStatus.appendChild(createStatusBadge(streamInfo.status));
    cellStatus.classList.add('status-col');

    const cellTitle = row.insertCell(); // Celda 3
    cellTitle.textContent = streamInfo.title || '-';
    cellTitle.title = streamInfo.title || ''; 
    cellTitle.classList.add('stream-title-col'); 

    const cellViewers = row.insertCell(); // Celda 4
    cellViewers.textContent = (typeof streamInfo.viewers === 'number') ? streamInfo.viewers.toLocaleString('en-US') : '-';
    cellViewers.classList.add('viewers-col'); 

    const cellLastCheck = row.insertCell(); // Celda 5
    cellLastCheck.textContent = streamInfo.lastCheck || new Date().toLocaleTimeString('en-US');
    cellLastCheck.classList.add('last-check-col');

    const cellActions = row.insertCell(); // Celda 6
    cellActions.classList.add('actions-col', 'text-center');
    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-outline-danger btn-sm action-delete';
    deleteButton.innerHTML = '<i class="bi bi-trash"></i>';
    deleteButton.title = 'Delete Stream';
    deleteButton.setAttribute('data-originalinput', streamInfo.originalInput);
    cellActions.appendChild(deleteButton);
}

function updateStreamRow(streamInfo) {
    if (!streamResultsBody) return;
    const stableRowKey = (streamInfo.originalInput || `stream-${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9-_]/g, '');
    const rowId = `stream-row-${stableRowKey}`;
    let row = document.getElementById(rowId);

    if (row) {
        const cellNameIdentifier = row.cells[1];
        cellNameIdentifier.innerHTML = ''; 
        const link = document.createElement('a');
        const urlToLink = streamInfo.originalInput;
        link.href = (urlToLink && (urlToLink.toLowerCase().startsWith('http://') || urlToLink.toLowerCase().startsWith('https://'))) 
                    ? urlToLink : '#';
        if (link.href === '#') {
            const lowerPlatform = streamInfo.platform ? streamInfo.platform.toLowerCase() : '';
            const identifierForLinkFallback = streamInfo.identifier || streamInfo.originalInput;
            if (lowerPlatform === 'twitch') link.href = `https://twitch.tv/${identifierForLinkFallback}`;
            else if (lowerPlatform === 'kick') link.href = `https://kick.com/${identifierForLinkFallback}`;
        }
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'channel-link';
        const nicknameSpan = document.createElement('span');
        nicknameSpan.className = 'channel-nickname d-block';
        nicknameSpan.textContent = streamInfo.nickname || streamInfo.name || streamInfo.originalInput || 'N/A';
        link.appendChild(nicknameSpan);
        cellNameIdentifier.appendChild(link);
        
        if (streamInfo.name && streamInfo.name !== (streamInfo.nickname || streamInfo.originalInput)) {
           const officialNameSpan = document.createElement('span');
           officialNameSpan.className = 'channel-official-name d-block text-muted';
           officialNameSpan.textContent = `(${streamInfo.name})`; 
           cellNameIdentifier.appendChild(officialNameSpan);
        }
        
        row.cells[2].innerHTML = ''; 
        row.cells[2].appendChild(createStatusBadge(streamInfo.status));
        row.cells[3].textContent = streamInfo.title || '-';
        row.cells[3].title = streamInfo.title || '';
        row.cells[4].textContent = (typeof streamInfo.viewers === 'number') ? streamInfo.viewers.toLocaleString('en-US') : '-';
        row.cells[5].textContent = streamInfo.lastCheck || new Date().toLocaleTimeString('en-US');
        // La celda de acciones (row.cells[6]) ya tiene el botón de eliminar, no necesita actualización dinámica aquí.
    } else { 
        console.warn(`ui.js: Row ID ${rowId} not found for update. Adding new row.`);
        addStreamToTable(streamInfo); 
    }
}

function displayStreamsInTable(streamsToDisplay) {
    if (!streamResultsBody) return;
    clearStreamTable(); 

    if (streamsToDisplay && streamsToDisplay.length > 0) {
        if (typeof showNoStreamsMessage === 'function') showNoStreamsMessage(false);
        streamsToDisplay.forEach(streamInfo => {
            addStreamToTable(streamInfo); 
        });
    } else {
        if (typeof showNoStreamsMessage === 'function') showNoStreamsMessage(true);
    }
}

function showLoadingIndicator(isLoading) { /* ... (como antes) ... */ }
function showAppMessage(message, type = 'info', duration = 5000) { /* ... (como antes, con textos en inglés) ... */ }
function updateGlobalLastCheckTime(timeString) { /* ... (como antes) ... */ }
function showNoStreamsMessage(show) { /* ... (como antes, con texto en inglés) ... */ }
function uiUpdateApiKeyStatus(message, isError = false) { /* ... (como antes) ... */ }
function uiUpdateYoutubeQuotaStatus(message, quotaExceeded = false) { /* ... (como antes) ... */ }

document.addEventListener('DOMContentLoaded', () => {
    if (streamResultsBody && streamResultsBody.children.length === 0) {
        if (typeof showNoStreamsMessage === 'function') {
            showNoStreamsMessage(true);
        }
    }
});