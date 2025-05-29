// js/app.js

console.log("app.js: Script iniciado y parseado por el navegador.");

document.addEventListener('DOMContentLoaded', () => {
    console.log("app.js: Evento DOMContentLoaded disparado. El HTML está listo.");

    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        console.warn('app.js: Usuario no autenticado. Redirigiendo a index.html...');
        window.location.href = 'index.html';
        return;
    } else if (typeof isUserLoggedIn !== 'function') {
        console.error("app.js: La función isUserLoggedIn() no está definida.");
        return;
    }
    console.log("app.js: Usuario autenticado.");

    const urlInputArea = document.getElementById('urlInputArea');
    const checkStreamsButton = document.getElementById('checkStreamsButton');
    const logoutButton = document.getElementById('logoutButton');
    const filterByNameInput = document.getElementById('filterByName');
    const filterByPlatformSelect = document.getElementById('filterByPlatform');

    let monitoredStreams = []; // Array original con todos los datos
    let refreshIntervalId = null;
    const REFRESH_INTERVAL_MS = 60000 * 2;
    
    let filterNameValue = '';
    let filterPlatformValue = '';

    console.log("app.js: Variables de estado inicializadas.");

    function initializeApp() {
        console.log("app.js: initializeApp() llamada.");
        setupEventListeners();
        console.log("app.js: setupEventListeners() llamada desde initializeApp.");
        applyFiltersAndRender(); // Mostrar tabla vacía o con mensaje "no streams" inicialmente
        console.log("app.js: initializeApp() completada.");
    }

    function setupEventListeners() {
        console.log("app.js: setupEventListeners() ejecutándose.");
        if (checkStreamsButton) {
            checkStreamsButton.addEventListener('click', handleCheckStreams);
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
        console.log("app.js: setupEventListeners() completado.");
    }

    async function handleCheckStreams() {
        console.log("app.js: handleCheckStreams() llamado.");
        if (!urlInputArea) {
            console.error("app.js: Elemento urlInputArea no encontrado.");
            if (typeof showAppMessage === 'function') showAppMessage('Error interno: Área de texto no encontrada.', 'danger');
            return;
        }
        const textContent = urlInputArea.value;
        if (!textContent.trim()) {
            if (typeof showAppMessage === 'function') showAppMessage('Por favor, pega algunas URLs.', 'warning');
            return;
        }

        if (typeof showLoadingIndicator === 'function') showLoadingIndicator(true);
        // clearStreamTable() ahora se llama dentro de displayStreamsInTable que es llamado por applyFiltersAndRender
        monitoredStreams = []; // Resetear datos base
        console.log("app.js: Streams monitoreados reseteados.");

        try {
            const parsedInputs = parseInputLines(textContent);
            console.log("app.js: Entradas parseadas:", JSON.parse(JSON.stringify(parsedInputs)));

            if (parsedInputs.length === 0) {
                if (typeof showAppMessage === 'function') showAppMessage('No se encontraron URLs válidas.', 'warning');
                applyFiltersAndRender(); // Para mostrar el mensaje "no streams"
                if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false);
                return;
            }
            if (typeof showAppMessage === 'function') showAppMessage(`Procesando ${parsedInputs.length} entradas...`, 'info', 3000);

            parsedInputs.forEach(input => {
                monitoredStreams.push({
                    platform: input.platform || 'unknown',
                    identifier: input.identifier,      
                    name: input.originalInput,         
                    originalInput: input.originalInput, 
                    status: 'Pendiente...',
                    lastCheck: '-',
                    title: null, viewers: null, details: null
                });
            });
            applyFiltersAndRender(); // Mostrar filas con estado "Pendiente"
            console.log("app.js: Streams iniciales añadidos para monitoreo.");

            await checkAllStreams(); // Esto actualizará monitoredStreams y luego llamará a applyFiltersAndRender
            console.log("app.js: Verificación inicial completada.");

            if (refreshIntervalId) clearInterval(refreshIntervalId);
            refreshIntervalId = setInterval(checkAllStreams, REFRESH_INTERVAL_MS);
            console.log("app.js: Intervalo de refresco iniciado.");
        } catch (error) {
            console.error("app.js: Error en handleCheckStreams:", error);
            if (typeof showAppMessage === 'function') showAppMessage('Error al procesar URLs.', 'danger');
            if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false);
        } finally {
            // showLoadingIndicator(false) se maneja en checkAllStreams o si hay error temprano
            if (typeof updateGlobalLastCheckTime === 'function') updateGlobalLastCheckTime(new Date().toLocaleTimeString());
            console.log("app.js: handleCheckStreams() finalizado.");
        }
    }

    function parseInputLines(textContent) {
        // ... (Tu función parseInputLines que ya funciona para detectar plataformas) ...
        // Asegúrate de que esta función devuelva un array de objetos con:
        // { platform: '...', identifier: 'url_limpia_o_id', originalInput: 'linea_original_trimeada' }
        console.log("app.js: parseInputLines() INICIO.");
        const lines = textContent.split(/\r?\n/);
        const inputs = [];
        lines.forEach((line, index) => {
            let processedLine = line.trim();
            if (processedLine.endsWith('[Object Object]')) {
                processedLine = processedLine.slice(0, -15).trim();
            }
            const parts = processedLine.split(/\s+/);
            if (parts.length > 1 && parts[0].toLowerCase().startsWith('http')) {
                processedLine = parts[0];
            }
            if (processedLine === '' || processedLine.startsWith('#')) return;
            
            const lowerLine = processedLine.toLowerCase();
            let platform = 'unknown';

            if (lowerLine.includes('twitch.tv/')) platform = 'twitch';
            else if (lowerLine.includes('youtube.com/') || lowerLine.includes('youtu.be/')) platform = 'youtube';
            else if (lowerLine.includes('kick.com/')) platform = 'kick';
            else if (lowerLine.includes('facebook.com/')) platform = 'facebook';
            
            inputs.push({ originalInput: processedLine, identifier: processedLine, platform: platform });
        });
        console.log("app.js: parseInputLines() FIN. Entradas:", JSON.parse(JSON.stringify(inputs)));
        return inputs;
    }

    function applyFiltersAndRender() {
        if (!monitoredStreams) return;
        let streamsToDisplay = monitoredStreams;

        if (filterNameValue) {
            streamsToDisplay = streamsToDisplay.filter(stream =>
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
        console.log("app.js: Mostrando streams filtrados:", JSON.parse(JSON.stringify(streamsToDisplay)));
        if (typeof displayStreamsInTable === 'function') {
            displayStreamsInTable(streamsToDisplay);
        } else {
            console.error("app.js: displayStreamsInTable no está definida en ui.js");
        }
    }

    async function processStreamCheck(streamToUpdateRef, index) { // Recibe la referencia del array
        const originalInputForLog = streamToUpdateRef.originalInput; // Para logging, ya que streamToUpdateRef se modifica
        console.log(`app.js: processStreamCheck() para [${index}] (Original: ${originalInputForLog}, ID API: ${streamToUpdateRef.identifier}) (${streamToUpdateRef.platform})`);
        
        let streamApiFunction;
        const platformKey = streamToUpdateRef.platform.toLowerCase();

        switch (platformKey) {
            case 'youtube': streamApiFunction = typeof getYouTubeStreamStatus === 'function' ? getYouTubeStreamStatus : null; break;
            case 'facebook': streamApiFunction = typeof getFacebookStreamStatus === 'function' ? getFacebookStreamStatus : null; break;
            case 'twitch': streamApiFunction = typeof getTwitchStreamStatus === 'function' ? getTwitchStreamStatus : null; break;
            case 'kick': streamApiFunction = typeof getKickStreamStatus === 'function' ? getKickStreamStatus : null; break;
            default:
                console.warn(`app.js: Plataforma no soportada: ${platformKey} para ${originalInputForLog}`);
                monitoredStreams[index] = { ...streamToUpdateRef, status: 'No Soportado', lastCheck: new Date().toLocaleTimeString() };
                return; // No se llama a applyFiltersAndRender aquí directamente, checkAllStreams lo hará
        }

        if (!streamApiFunction) {
            console.error(`app.js: Función API no definida para ${platformKey}.`);
            monitoredStreams[index] = { ...streamToUpdateRef, status: 'Error Config.', lastCheck: new Date().toLocaleTimeString() };
            return;
        }

        try {
            const apiResponse = await streamApiFunction(streamToUpdateRef.identifier);
            monitoredStreams[index] = {
                ...streamToUpdateRef,
                name: apiResponse.name || streamToUpdateRef.name,
                identifier: apiResponse.identifier || streamToUpdateRef.identifier,
                status: apiResponse.status || 'Error Desconocido',
                title: apiResponse.title,
                viewers: apiResponse.viewers,
                details: apiResponse.details,
                platform: apiResponse.platform || streamToUpdateRef.platform,
                lastCheck: new Date().toLocaleTimeString()
            };
            console.log(`app.js: Respuesta de API para ${originalInputForLog}:`, JSON.parse(JSON.stringify(monitoredStreams[index])));
        } catch (error) {
            console.error(`app.js: Error en API call para ${originalInputForLog}:`, error);
            monitoredStreams[index] = { ...streamToUpdateRef, status: 'Error API', lastCheck: new Date().toLocaleTimeString(), details: error.message };
        }
    }

    async function checkAllStreams() {
        console.log("app.js: checkAllStreams() llamado.");
        if (monitoredStreams.length === 0) {
            applyFiltersAndRender(); // Asegurar que la tabla se limpie y muestre "no streams"
            if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false);
            return;
        }
        if (typeof showLoadingIndicator === 'function') showLoadingIndicator(true);

        const promises = monitoredStreams.map((stream, index) => processStreamCheck(stream, index));

        try {
            await Promise.all(promises);
            console.log("app.js: Todas las promesas de processStreamCheck resueltas.");
        } catch (error) {
            console.error("app.js: Error durante Promise.all en checkAllStreams:", error);
            if (typeof showAppMessage === 'function') showAppMessage('Algunas verificaciones fallaron.', 'warning');
        } finally {
            applyFiltersAndRender(); // Renderizar la tabla con los datos actualizados y filtros aplicados
            if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false);
            if (typeof updateGlobalLastCheckTime === 'function') updateGlobalLastCheckTime(new Date().toLocaleTimeString());
            console.log("app.js: checkAllStreams() finalizado.");
        }
    }
    
    initializeApp();
    console.log("app.js: initializeApp() ha sido invocada.");
});

console.log("app.js: Script finalizado. Esperando DOMContentLoaded.");