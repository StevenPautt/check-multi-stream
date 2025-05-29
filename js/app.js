// js/app.js

// AL INICIO DE js/app.js (antes de todo)
console.log("app.js: Script initiated and parsed by browser.");

document.addEventListener('DOMContentLoaded', () => {
    console.log("app.js: DOMContentLoaded event fired. HTML is ready.");

    // --- Autenticación y Protección de Ruta ---
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        console.warn('app.js: User not authenticated. Redirecting to index.html...');
        window.location.href = 'index.html';
        return;
    } else if (typeof isUserLoggedIn !== 'function') {
        console.error("app.js: isUserLoggedIn() function is not defined. Ensure auth.js is loaded first.");
        return;
    }
    console.log("app.js: User authenticated. Continuing app initialization...");


    // --- Selectores de Elementos del DOM ---
    const urlInputArea = document.getElementById('urlInputArea');
    const checkStreamsButton = document.getElementById('checkStreamsButton');
    const logoutButton = document.getElementById('logoutButton');
    const filterByNameInput = document.getElementById('filterByName');
    const filterByPlatformSelect = document.getElementById('filterByPlatform');
    const youtubeApiKeyInput = document.getElementById('youtubeApiKeyInput');
    const saveApiKeyButton = document.getElementById('saveApiKeyButton');
    const youtubeApiKeyForm = document.getElementById('youtubeApiKeyForm');
    const manualRefreshButton = document.getElementById('manualRefreshButton');
    const exportListButton = document.getElementById('exportListButton');
    const importListButton = document.getElementById('importListButton');
    const importFileInput = document.getElementById('importFileInput');

    // --- Estado de la Aplicación ---
    let monitoredStreams = [];
    let refreshIntervalId = null;
    const REFRESH_INTERVAL_MS = 60000 * 5; // 5 minutos
    
    let filterNameValue = '';
    let filterPlatformValue = '';

    const YT_API_KEY_LS = 'youtubeApiKey';
    const YT_QUOTA_COUNT_LS = 'youtubeQuotaCount';
    const YT_QUOTA_DATE_LS = 'youtubeQuotaDate';
    const YT_DAILY_QUOTA_LIMIT = 9000;
    let currentYoutubeApiKey = '';

    const STREAM_LIST_LS_KEY = 'multiStreamCheckerList';

    console.log("app.js: State variables initialized.");

    // --- Funciones de Persistencia ---
    function saveStreamListToLocalStorage() {
        if (urlInputArea) {
            localStorage.setItem(STREAM_LIST_LS_KEY, urlInputArea.value);
            console.log("app.js: Stream list saved to localStorage.");
        }
    }

    function loadStreamListFromLocalStorage() {
        const savedList = localStorage.getItem(STREAM_LIST_LS_KEY);
        if (savedList && urlInputArea) {
            urlInputArea.value = savedList;
            console.log("app.js: Stream list loaded from localStorage into textarea.");
            if (typeof showAppMessage === 'function') {
                showAppMessage('Previously saved list loaded. Click "Check All" or "Manual Refresh" to process.', 'info', 7000);
            }
        } else {
            console.log("app.js: No saved stream list found in localStorage.");
        }
    }

    // --- Funciones de Importar/Exportar ---
    function handleExportList() {
        console.log("app.js: handleExportList function CALLED.");
        if (!urlInputArea || !urlInputArea.value.trim()) {
            if (typeof showAppMessage === 'function') showAppMessage('Nothing to export. Paste some URLs first.', 'warning');
            return;
        }
        const textToSave = urlInputArea.value;
        const blob = new Blob([textToSave], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'stream_list.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        if (typeof showAppMessage === 'function') showAppMessage('Stream list exported as stream_list.txt!', 'success');
    }

    function handleImportFile(event) {
        console.log("app.js: handleImportFile function CALLED.");
        const file = event.target.files[0];
        if (!file) {
            console.log("app.js: No file selected for import.");
            return;
        }
        if (!file.name.endsWith('.txt') && !file.name.endsWith('.csv') && file.type !== "text/plain" && file.type !== "text/csv") {
            if (typeof showAppMessage === 'function') showAppMessage('Invalid file type. Please select a .txt or .csv file.', 'danger');
            event.target.value = null;
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const fileContent = e.target.result;
            if (urlInputArea) {
                urlInputArea.value = fileContent;
                saveStreamListToLocalStorage();
                if (typeof showAppMessage === 'function') showAppMessage('List imported successfully! Click "Check All" to process.', 'success', 5000);
            }
        };
        reader.onerror = (e) => {
            console.error("app.js: Error reading file for import:", e);
            if (typeof showAppMessage === 'function') showAppMessage('Error reading file.', 'danger');
        };
        reader.readAsText(file);
        event.target.value = null;
    }

    // --- Inicialización ---
    function initializeApp() {
        console.log("app.js: initializeApp() called.");
        loadYoutubeApiKey();
        loadStreamListFromLocalStorage();
        setupEventListeners();
        applyFiltersAndRender();
        console.log("app.js: initializeApp() completed.");
    }
    
    function loadYoutubeApiKey() {
        currentYoutubeApiKey = localStorage.getItem(YT_API_KEY_LS) || '';
        if (youtubeApiKeyInput) youtubeApiKeyInput.value = currentYoutubeApiKey;
        if (typeof uiUpdateApiKeyStatus === 'function') {
            uiUpdateApiKeyStatus(currentYoutubeApiKey ? 'YouTube API Key loaded from storage.' : 'No YouTube API Key configured.');
        }
        updateYoutubeQuotaStatus();
    }

    function saveYoutubeApiKeyAction(event) {
        if(event) event.preventDefault();
        if (youtubeApiKeyInput) {
            currentYoutubeApiKey = youtubeApiKeyInput.value.trim();
            if (currentYoutubeApiKey) {
                localStorage.setItem(YT_API_KEY_LS, currentYoutubeApiKey);
                if (typeof showAppMessage === 'function') showAppMessage('YouTube API Key saved!', 'success', 3000);
            } else {
                localStorage.removeItem(YT_API_KEY_LS);
                if (typeof showAppMessage === 'function') showAppMessage('YouTube API Key removed.', 'info', 3000);
            }
            if (typeof uiUpdateApiKeyStatus === 'function') {
                 uiUpdateApiKeyStatus(currentYoutubeApiKey ? 'YouTube API Key saved.' : 'YouTube API Key removed.');
            }
            resetYoutubeQuotaCount(); 
            updateYoutubeQuotaStatus();
        }
    }
    
    function updateYoutubeQuotaStatus() {
        if (!currentYoutubeApiKey) {
             if (typeof uiUpdateYoutubeQuotaStatus === 'function') uiUpdateYoutubeQuotaStatus('Set YouTube API Key to track quota.', false);
            return;
        }
        const count = getYoutubeQuotaCount();
        const remaining = YT_DAILY_QUOTA_LIMIT - count;
        const message = `YouTube API Quota: ~${count} units used. ~${remaining > 0 ? remaining : 0} remaining. (Resets daily PT)`;
        if (typeof uiUpdateYoutubeQuotaStatus === 'function') uiUpdateYoutubeQuotaStatus(message, remaining <= 0);
    }

    function getYoutubeQuotaCount() {
        const today = new Date().toISOString().split('T')[0];
        const savedDate = localStorage.getItem(YT_QUOTA_DATE_LS);
        if (savedDate !== today) {
            localStorage.setItem(YT_QUOTA_COUNT_LS, '0');
            localStorage.setItem(YT_QUOTA_DATE_LS, today);
            console.log("app.js: YouTube quota count reset for new day.");
            return 0;
        }
        return parseInt(localStorage.getItem(YT_QUOTA_COUNT_LS) || '0');
    }

    function incrementYoutubeQuotaCount(cost = 100) {
        if (!currentYoutubeApiKey) return getYoutubeQuotaCount(); 
        let count = getYoutubeQuotaCount();
        count += cost;
        localStorage.setItem(YT_QUOTA_COUNT_LS, count.toString());
        console.log(`app.js: YouTube quota incremented by ${cost}. New count: ${count}`);
        updateYoutubeQuotaStatus();
        return count;
    }
    
    function resetYoutubeQuotaCount(){
        console.log("app.js: Resetting YouTube quota count manually (e.g. new key).");
        localStorage.setItem(YT_QUOTA_COUNT_LS, '0');
        localStorage.setItem(YT_QUOTA_DATE_LS, new Date().toISOString().split('T')[0]);
        updateYoutubeQuotaStatus();
    }

    function setupEventListeners() {
        console.log("app.js: setupEventListeners() running.");
        if (checkStreamsButton) {
            // El botón "Check All (from Textarea)" ahora SÍ intentará verificar YouTube la primera vez
            checkStreamsButton.addEventListener('click', () => handleCheckStreams(true)); 
        }
        if (manualRefreshButton) {
            manualRefreshButton.addEventListener('click', () => {
                console.log("app.js: Manual Refresh All button clicked.");
                if (monitoredStreams.length === 0) {
                    if(typeof showAppMessage === 'function') showAppMessage('No streams to refresh. Please add URLs and click "Check All" first.', 'info');
                    return;
                }
                checkAllStreams(true); // true = SÍ verificar YouTube
            });
        }
        if (youtubeApiKeyForm) { 
            youtubeApiKeyForm.addEventListener('submit', saveYoutubeApiKeyAction);
        } else if (saveApiKeyButton) { 
             saveApiKeyButton.addEventListener('click', saveYoutubeApiKeyAction);
        }
        if (exportListButton) { 
            exportListButton.addEventListener('click', handleExportList);
            console.log("app.js: Event listener for 'click' on exportListButton added.");
        }
        if (importListButton) { 
            importListButton.addEventListener('click', () => {
                if(importFileInput) {
                    console.log("app.js: Import List button clicked, triggering hidden file input.");
                    importFileInput.click(); 
                } else {
                    console.warn("app.js: importFileInput element not found.");
                }
            });
            console.log("app.js: Event listener for 'click' on importListButton added.");
        }
        if (importFileInput) { 
            importFileInput.addEventListener('change', handleImportFile);
            console.log("app.js: Event listener for 'change' on importFileInput added.");
        }
        
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                if (refreshIntervalId) clearInterval(refreshIntervalId);
                if (typeof logoutUser === 'function') logoutUser();
            });
        }
        if (filterByNameInput) {
            filterByNameInput.addEventListener('input', (event) => {
                filterNameValue = event.target.value.toLowerCase();
                applyFiltersAndRender();
            });
        }
        if (filterByPlatformSelect) {
            filterByPlatformSelect.addEventListener('change', (event) => {
                filterPlatformValue = event.target.value;
                applyFiltersAndRender();
            });
        }
        console.log("app.js: setupEventListeners() completed.");
    }

    // isForceYouTubeCheck: true si YouTube debe ser verificado (ej. carga inicial desde textarea, o refresh manual)
    //                     false si es un auto-refresco (donde YouTube se omite)
    async function handleCheckStreams(isForceYouTubeCheck = false) { 
        console.log(`app.js: handleCheckStreams() called. Force YouTube: ${isForceYouTubeCheck}`);
        
        if (!urlInputArea) { 
            console.error("app.js: urlInputArea element not found.");
            if(typeof showAppMessage === 'function') showAppMessage('Internal error: URL input area not found.', 'danger');
            return;
        }
        const textContent = urlInputArea.value;

        if (!textContent.trim()) { 
            if(typeof showAppMessage === 'function') showAppMessage('Please paste some URLs first.', 'warning');
            return; 
        }

        saveStreamListToLocalStorage(); 

        if (typeof showLoadingIndicator === 'function') showLoadingIndicator(true);
        
        monitoredStreams = []; 
        if (typeof clearStreamTable === 'function') clearStreamTable();
        console.log("app.js: Monitored streams reset and table cleared.");

        // Solo procesar el textarea si tiene contenido.
        // Si es un manual refresh sin contenido en textarea, checkAllStreams usará la lista existente.
        if (textContent.trim()){
            const parsedInputs = parseInputLines(textContent); 
            console.log("app.js: Parsed inputs from textarea:", JSON.parse(JSON.stringify(parsedInputs)));

            if (parsedInputs.length === 0) {
                if (typeof showAppMessage === 'function') showAppMessage('No valid URLs found in the input text.', 'warning');
                applyFiltersAndRender(); 
                if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false);
                return;
            }
            if (typeof showAppMessage === 'function') showAppMessage(`Processing ${parsedInputs.length} entries...`, 'info', 3000);

            monitoredStreams = parsedInputs.map(input => ({
                platform: input.platform || 'unknown',
                identifier: input.url, 
                name: input.nickname,  
                originalInput: input.url, 
                nickname: input.nickname, 
                status: 'Pending...',
                lastCheck: '-',
                title: null, viewers: null, details: null
            }));
            applyFiltersAndRender(); 
            console.log("app.js: Initial streams populated for monitoring.");
        } else if (monitoredStreams.length === 0 && !isForceYouTubeCheck) { 
            // Si el textarea está vacío Y NO es un manual refresh (que podría operar sobre una lista ya cargada)
            applyFiltersAndRender();
            if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false);
            return;
        }
        
        // La primera verificación después de procesar el textarea (isForceYouTubeCheck = true) SÍ incluirá YouTube.
        // Los refrescos automáticos (isForceYouTubeCheck = false) NO incluirán YouTube.
        // El botón "Manual Refresh All" llama a checkAllStreams(true) directamente.
        await checkAllStreams(isForceYouTubeCheck); 
        console.log("app.js: Stream check cycle completed.");

        if (refreshIntervalId) clearInterval(refreshIntervalId);
        refreshIntervalId = setInterval(() => checkAllStreams(false), REFRESH_INTERVAL_MS); // Auto-refresh NO fuerza YT
        console.log("app.js: Refresh interval updated.");
        
        if (typeof updateGlobalLastCheckTime === 'function') updateGlobalLastCheckTime(new Date().toLocaleTimeString('en-US'));
        console.log("app.js: handleCheckStreams() finished.");
    }
    
    // Tu función parseInputLines (la que te funciona para detectar plataformas y extraer nickname, url)
    function parseInputLines(textContent) {
        console.log("app.js: parseInputLines() START.");
        const lines = textContent.split(/\r?\n/);
        const inputs = [];
        lines.forEach((line, index) => {
            let processedLine = line.trim();
            let nickname = null;
            let urlPart = processedLine;
            const commaIndex = processedLine.indexOf(',');
            if (commaIndex !== -1) {
                nickname = processedLine.substring(0, commaIndex).trim();
                urlPart = processedLine.substring(commaIndex + 1).trim();
            } else {
                nickname = urlPart; // Si no hay coma, la URL es también el "nickname"
            }
            
            const objectObjectString = "[Object Object]";
            if (urlPart.endsWith(objectObjectString)) {
                console.warn(`DEBUG: Line ${index + 1} - Detected "${objectObjectString}" at the end of URL part. Cleaning.`);
                urlPart = urlPart.slice(0, -objectObjectString.length).trim();
            }
            const parts = urlPart.split(/\s+/);
            if (parts.length > 0 && (parts[0].toLowerCase().startsWith('http://') || parts[0].toLowerCase().startsWith('https://'))) {
                if (parts.length > 1) {
                     console.warn(`DEBUG: Line ${index + 1} - Spaces detected after initial URL in URL part. Using first part: "${parts[0]}"`);
                }
                urlPart = parts[0];
            }

            if (urlPart === '' || urlPart.startsWith('#')) {
                console.log(`DEBUG: Line ${index + 1} ignored (empty or comment).`);
                return; 
            }
            
            const lowerUrl = urlPart.toLowerCase();
            let platform = 'unknown';

            // Tu lógica de detección de plataformas
            if (lowerUrl.includes('twitch.tv/')) platform = 'twitch';
            else if (lowerUrl.includes('youtube.com/') || lowerUrl.includes('youtu.be/')) platform = 'youtube';
            else if (lowerUrl.includes('kick.com/')) platform = 'kick';
            else if (lowerUrl.includes('facebook.com/')) platform = 'facebook';
            
            console.log(`DEBUG: Line ${index + 1} - Nickname: "${nickname}", URL Part: "${urlPart}", Platform: ${platform}`);
            inputs.push({ 
                nickname: nickname, 
                url: urlPart, // Este es el 'identifier' que se usará para la API
                platform: platform,
                originalInputLine: line // La línea original del textarea por si acaso
            });
        });
        console.log("app.js: parseInputLines() END. Detected inputs:", JSON.parse(JSON.stringify(inputs)));
        return inputs;
    }

    function applyFiltersAndRender() {
        if (!monitoredStreams) return;
        let streamsToDisplay = monitoredStreams;
        if (filterNameValue) { 
            streamsToDisplay = streamsToDisplay.filter(stream =>
                (stream.nickname && stream.nickname.toLowerCase().includes(filterNameValue)) ||
                (stream.name && stream.name.toLowerCase().includes(filterNameValue)) ||
                (stream.identifier && stream.identifier.toLowerCase().includes(filterNameValue)) ||
                (stream.originalInput && stream.originalInput.toLowerCase().includes(filterNameValue)) ||
                (stream.title && stream.title.toLowerCase().includes(filterNameValue)) 
            );
        }
        if (filterPlatformValue) {
             streamsToDisplay = streamsToDisplay.filter(stream =>
                stream.platform && stream.platform.toLowerCase() === filterPlatformValue
            );
        }
        console.log("app.js: Displaying filtered streams:", JSON.parse(JSON.stringify(streamsToDisplay)));
        if (typeof displayStreamsInTable === 'function') {
            displayStreamsInTable(streamsToDisplay);
        } else {
            console.error("app.js: displayStreamsInTable is not defined in ui.js");
        }
    }

    async function processStreamCheck(streamEntry, index, isForceYouTubeCheck) { 
        const originalNicknameForLog = streamEntry.nickname;
        const urlForApi = streamEntry.identifier; // Este es el 'url' limpio de parseInputLines
        console.log(`app.js: processStreamCheck() for [${index}] (Nickname: ${originalNicknameForLog}, URL: ${urlForApi}, Platform: ${streamEntry.platform}, ForceYouTube: ${isForceYouTubeCheck})`);
        
        let streamApiFunction;
        const platformKey = streamEntry.platform.toLowerCase();

        if (platformKey === 'youtube' && !isForceYouTubeCheck) { 
            console.log("app.js: YouTube check skipped (not forced for auto-refresh).");
            // No actualizamos el estado, mantenemos el último conocido o "Pendiente"
            // La UI no se actualizará para esta fila específica en este ciclo de auto-refresco.
            return; // Importante retornar para no continuar con la llamada API
        }
        
        let apiKeyForYouTube = null;
        if (platformKey === 'youtube') {
            apiKeyForYouTube = currentYoutubeApiKey;
            if (!apiKeyForYouTube) {
                console.warn(`app.js: No API Key for YouTube for ${originalNicknameForLog}.`);
                monitoredStreams[index] = { ...streamEntry, status: 'Config Error', details: 'YouTube API Key needed.', lastCheck: new Date().toLocaleTimeString('en-US') };
                return; 
            }
            const quotaCount = getYoutubeQuotaCount();
            if (quotaCount >= YT_DAILY_QUOTA_LIMIT) {
                console.warn(`app.js: YouTube quota possibly exceeded for ${originalNicknameForLog}. Count: ${quotaCount}`);
                monitoredStreams[index] = { ...streamEntry, status: 'API Error', details: 'YouTube quota likely exceeded.', lastCheck: new Date().toLocaleTimeString('en-US') };
                updateYoutubeQuotaStatus(); 
                return;
            }
        }

        switch (platformKey) {
            case 'youtube': streamApiFunction = typeof getYouTubeStreamStatus === 'function' ? getYouTubeStreamStatus : null; break;
            case 'facebook': streamApiFunction = typeof getFacebookStreamStatus === 'function' ? getFacebookStreamStatus : null; break;
            case 'twitch': streamApiFunction = typeof getTwitchStreamStatus === 'function' ? getTwitchStreamStatus : null; break;
            case 'kick': streamApiFunction = typeof getKickStreamStatus === 'function' ? getKickStreamStatus : null; break;
            default:
                console.warn(`app.js: Unsupported platform: ${platformKey} for ${originalNicknameForLog}`);
                monitoredStreams[index] = { ...streamEntry, status: 'Unsupported', lastCheck: new Date().toLocaleTimeString('en-US') };
                return;
        }
        if (!streamApiFunction) {
            console.error(`app.js: API function not defined for ${platformKey}.`);
            monitoredStreams[index] = { ...streamEntry, status: 'Config Error', lastCheck: new Date().toLocaleTimeString('en-US') };
            return;
        }

        try {
            if (platformKey === 'youtube') {
                incrementYoutubeQuotaCount(100); // Asumir 100 por búsqueda, o 200 si resolución + estado
            }
            const apiResponse = await streamApiFunction(urlForApi, platformKey === 'youtube' ? apiKeyForYouTube : undefined); 
            
            monitoredStreams[index] = {
                ...streamEntry, // Preserva originalInput, nickname
                name: apiResponse.name || streamEntry.nickname, 
                identifier: apiResponse.identifier || urlForApi, 
                status: apiResponse.status || 'Unknown Error',
                title: apiResponse.title,
                viewers: apiResponse.viewers,
                details: apiResponse.details,
                platform: apiResponse.platform || streamEntry.platform, 
                lastCheck: new Date().toLocaleTimeString('en-US')
            };
            console.log(`app.js: API response for ${originalNicknameForLog}:`, JSON.parse(JSON.stringify(monitoredStreams[index])));
            
            if (platformKey === 'youtube' && monitoredStreams[index].details && monitoredStreams[index].details.toLowerCase().includes('quotaexceeded')) {
                updateYoutubeQuotaStatus();
            }
        } catch (error) {
            console.error(`app.js: API call error for ${originalNicknameForLog}:`, error);
            monitoredStreams[index] = { ...streamEntry, status: 'API Error', lastCheck: new Date().toLocaleTimeString('en-US'), details: error.message };
        }
    }

    async function checkAllStreams(isForceYouTubeCheck = false) { 
        console.log(`app.js: checkAllStreams() called. Force YouTube: ${isForceYouTubeCheck}`);
        if (!monitoredStreams || monitoredStreams.length === 0) {
            applyFiltersAndRender();
            if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false);
            return;
        }
        if (typeof showLoadingIndicator === 'function') showLoadingIndicator(true);

        const promises = monitoredStreams.map((stream, i) => processStreamCheck(stream, i, isForceYouTubeCheck));

        try {
            await Promise.all(promises);
            console.log("app.js: All stream check promises resolved.");
        } catch (error) {
            console.error("app.js: Error during Promise.all in checkAllStreams:", error);
            if (typeof showAppMessage === 'function') showAppMessage('Some checks failed during refresh.', 'warning');
        } finally {
            applyFiltersAndRender(); 
            if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false);
            if (typeof updateGlobalLastCheckTime === 'function') updateGlobalLastCheckTime(new Date().toLocaleTimeString('en-US'));
            console.log("app.js: checkAllStreams() finished.");
        }
    }
    
    initializeApp();
    console.log("app.js: initializeApp() has been invoked.");
});

console.log("app.js: Script finished parsing. Waiting for DOMContentLoaded.");