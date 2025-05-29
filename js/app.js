// js/app.js

// AL INICIO DE js/app.js (antes de todo)
console.log("app.js: Script iniciado y parseado por el navegador.");

document.addEventListener('DOMContentLoaded', () => {
    console.log("app.js: Evento DOMContentLoaded disparado. El HTML está listo.");

    // --- Autenticación y Protección de Ruta ---
    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        console.warn('app.js: Usuario no autenticado. Redirigiendo a index.html...');
        window.location.href = 'index.html';
        return; 
    } else if (typeof isUserLoggedIn !== 'function') {
        console.error("app.js: La función isUserLoggedIn() no está definida. Asegúrate de que auth.js se carga antes.");
        return;
    }
    console.log("app.js: Usuario autenticado o la función isUserLoggedIn no está disponible. Continuando...");


    // --- Selectores de Elementos del DOM ---
    const fileInputControl = document.getElementById('fileInputControl');
    const checkStreamsButton = document.getElementById('checkStreamsButton');
    const logoutButton = document.getElementById('logoutButton');

    // --- Estado de la Aplicación ---
    let selectedFile = null;
    let monitoredStreams = []; 
    let refreshIntervalId = null;
    const REFRESH_INTERVAL_MS = 60000 * 2; 
    console.log("app.js: Variables de estado inicializadas.");

    // --- Inicialización ---
    function initializeApp() {
        console.log("app.js: initializeApp() llamada.");
        setupEventListeners();
        console.log("app.js: setupEventListeners() llamada desde initializeApp.");
        
        if (typeof showNoStreamsMessage === 'function') {
            showNoStreamsMessage(monitoredStreams.length === 0);
        } else {
            console.error("app.js: La función 'showNoStreamsMessage' no está disponible en initializeApp. ¿Se cargó ui.js correctamente?");
        }
        console.log("app.js: initializeApp() completada.");
    }

    // --- Manejadores de Eventos ---
    function setupEventListeners() {
        console.log("app.js: setupEventListeners() ejecutándose.");
        if (fileInputControl) {
            fileInputControl.addEventListener('change', handleFileSelect);
            console.log("app.js: Event listener para 'change' en fileInputControl añadido.");
        } else {
            console.warn("app.js: Elemento fileInputControl no encontrado.");
        }

        if (checkStreamsButton) {
            checkStreamsButton.addEventListener('click', handleCheckStreams);
            console.log("app.js: Event listener para 'click' en checkStreamsButton añadido.");
        } else {
            console.warn("app.js: Elemento checkStreamsButton no encontrado.");
        }

        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                console.log("app.js: Botón de logout clickeado.");
                if (refreshIntervalId) {
                    clearInterval(refreshIntervalId);
                    console.log("app.js: Intervalo de refresco detenido.");
                }
                if (typeof logoutUser === 'function') {
                    logoutUser(); 
                } else {
                    console.error("app.js: La función logoutUser() no está definida. ¿Se cargó auth.js?");
                }
            });
            console.log("app.js: Event listener para 'click' en logoutButton añadido.");
        } else {
            console.warn("app.js: Elemento logoutButton no encontrado.");
        }
        console.log("app.js: setupEventListeners() completado.");
    }

    function handleFileSelect(event) {
        console.log("app.js: handleFileSelect() llamado.");
        selectedFile = event.target.files[0];
        if (selectedFile) {
            console.log("app.js: Archivo seleccionado:", selectedFile.name);
            if (typeof updateFileNameDisplay === 'function' && typeof showAppMessage === 'function') {
                updateFileNameDisplay(selectedFile.name); 
                showAppMessage(`Archivo "${selectedFile.name}" seleccionado. Haz clic en "Verificar Streams".`, 'info', 7000); 
            } else {
                console.error("app.js: 'updateFileNameDisplay' o 'showAppMessage' (sin ui.) no disponible en handleFileSelect. ¿Se cargó ui.js?");
            }
        } else {
            console.log("app.js: Ningún archivo seleccionado.");
            if (typeof updateFileNameDisplay === 'function') {
                updateFileNameDisplay(null); 
            }
        }
    }

    async function handleCheckStreams() {
        console.log("app.js: handleCheckStreams() llamado.");
        if (!selectedFile) {
            console.warn("app.js: Intento de verificar streams sin archivo seleccionado.");
            if (typeof showAppMessage === 'function') {
                showAppMessage('Por favor, selecciona un archivo primero.', 'warning'); 
            }
            return;
        }

        if (typeof showLoadingIndicator === 'function') showLoadingIndicator(true); 
        if (typeof clearStreamTable === 'function') clearStreamTable();           
        monitoredStreams = [];
        console.log("app.js: Tabla limpiada y streams monitoreados reseteados.");

        try {
            const fileContent = await selectedFile.text();
            console.log("app.js: Contenido del archivo leído.");
            const parsedInputs = parseInputLines(fileContent); 
            console.log("app.js: Entradas parseadas del archivo:", parsedInputs);

            if (parsedInputs.length === 0) {
                console.warn("app.js: El archivo no contiene entradas válidas o está vacío.");
                if (typeof showAppMessage === 'function') showAppMessage('El archivo no contiene entradas válidas o está vacío.', 'warning'); 
                if (typeof showNoStreamsMessage === 'function') showNoStreamsMessage(true); 
                return; 
            }
            
            if (typeof showAppMessage === 'function') {
                showAppMessage(`Procesando ${parsedInputs.length} entradas...`, 'info', 3000); 
            }

            parsedInputs.forEach(input => {
                const initialStreamInfo = {
                    platform: input.platform || 'unknown',
                    identifier: input.identifier,
                    name: input.originalInput,
                    status: 'Pendiente...',
                    lastCheck: '-'
                };
                monitoredStreams.push(initialStreamInfo);
                if (typeof addStreamToTable === 'function') {
                    addStreamToTable(initialStreamInfo); 
                }
            });
            console.log("app.js: Streams iniciales añadidos a la tabla y a monitoredStreams.");

            await checkAllStreams(); 
            console.log("app.js: Primera verificación de todos los streams completada.");

            if (refreshIntervalId) {
                clearInterval(refreshIntervalId);
            }
            refreshIntervalId = setInterval(checkAllStreams, REFRESH_INTERVAL_MS);
            console.log("app.js: Intervalo de refresco configurado cada", REFRESH_INTERVAL_MS, "ms.");

        } catch (error) {
            console.error('app.js: Error procesando el archivo en handleCheckStreams:', error);
            if (typeof showAppMessage === 'function') {
                showAppMessage('Error al leer o procesar el archivo.', 'danger'); 
            }
        } finally {
            if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false); 
            if (typeof updateGlobalLastCheckTime === 'function') updateGlobalLastCheckTime(new Date().toLocaleTimeString()); 
            console.log("app.js: handleCheckStreams() finalizado.");
        }
    }

    // --- Lógica de Parseo y Verificación de Streams ---
    function parseInputLines(textContent) {
        console.log("app.js: parseInputLines() llamado con contenido de longitud:", textContent.length);
        const lines = textContent.split(/\r?\n/);
        const inputs = [];
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine === '' || trimmedLine.startsWith('#')) return;
            
            let platform = 'unknown';
            let identifier = trimmedLine;
            const lowerLine = trimmedLine.toLowerCase();

            // CORRECCIÓN AQUÍ: Hacer la detección de YouTube más genérica
            if (lowerLine.includes('youtube.com/c/ChannelName6')) { // Detecta la base de la URL de YouTube
                platform = 'youtube';
            } else if (lowerLine.includes('facebook.com/')) {
                platform = 'facebook';
            }
            // Podrías añadir más 'else if' para otras plataformas como Twitch
            // else if (lowerLine.includes('twitch.tv/')) {
            //     platform = 'twitch';
            // }
            inputs.push({ platform, identifier, originalInput: trimmedLine });
        });
        console.log("app.js: parseInputLines() completado. Entradas detectadas:", inputs);
        return inputs;
    }

    async function processStreamCheck(streamToUpdate, index) {
        console.log(`app.js: processStreamCheck() para [${index}] ${streamToUpdate.identifier} (${streamToUpdate.platform})`);
        let streamApiFunction;
        let platformKey = streamToUpdate.platform.toLowerCase();

        switch (platformKey) {
            case 'youtube':
                streamApiFunction = typeof getYouTubeStreamStatus === 'function' ? getYouTubeStreamStatus : null;
                break;
            case 'facebook':
                streamApiFunction = typeof getFacebookStreamStatus === 'function' ? getFacebookStreamStatus : null;
                break;
            default:
                console.warn(`app.js: Plataforma no soportada: ${streamToUpdate.platform} para ${streamToUpdate.identifier}`);
                const unsupportedInfo = { ...streamToUpdate, status: 'No Soportado', lastCheck: new Date().toLocaleTimeString() };
                monitoredStreams[index] = unsupportedInfo;
                if (typeof updateStreamRow === 'function') updateStreamRow(unsupportedInfo); 
                return;
        }

        if (!streamApiFunction) {
            console.error(`app.js: Función API no definida o no es una función para la plataforma: ${streamToUpdate.platform}. ¿Se cargó api_${platformKey}.js y define la función globalmente?`);
            const errorInfo = { ...streamToUpdate, status: 'Error Config.', lastCheck: new Date().toLocaleTimeString() };
            monitoredStreams[index] = errorInfo;
            if (typeof updateStreamRow === 'function') updateStreamRow(errorInfo); 
            return;
        }
        
        try {
            const updatedStreamInfoFromApi = await streamApiFunction(streamToUpdate.identifier); 
            
            monitoredStreams[index] = {
                ...streamToUpdate, 
                ...updatedStreamInfoFromApi, 
                identifier: updatedStreamInfoFromApi.identifier || streamToUpdate.identifier,
                platform: updatedStreamInfoFromApi.platform || streamToUpdate.platform,
                lastCheck: new Date().toLocaleTimeString()
            };
            console.log(`app.js: Respuesta de API para ${monitoredStreams[index].identifier}:`, monitoredStreams[index]);
            if (typeof updateStreamRow === 'function') updateStreamRow(monitoredStreams[index]); 
        } catch (error) {
            console.error(`app.js: Error en API call para ${streamToUpdate.identifier}:`, error);
            const errorInfo = { ...streamToUpdate, status: 'Error API', lastCheck: new Date().toLocaleTimeString(), details: error.message };
            monitoredStreams[index] = errorInfo;
            if (typeof updateStreamRow === 'function') updateStreamRow(errorInfo); 
        }
    }

    async function checkAllStreams() {
        console.log("app.js: checkAllStreams() llamado.");
        if (monitoredStreams.length === 0) {
            console.log("app.js: No hay streams para verificar en checkAllStreams.");
            if (typeof showNoStreamsMessage === 'function') showNoStreamsMessage(true); 
            return;
        }
        if (typeof showLoadingIndicator === 'function') showLoadingIndicator(true); 
        
        const promises = monitoredStreams.map((stream, index) => processStreamCheck(stream, index));
        
        try {
            await Promise.all(promises);
            console.log("app.js: Todas las promesas de processStreamCheck resueltas.");
        } catch (error) {
            console.error("app.js: Error durante Promise.all en checkAllStreams:", error);
            if (typeof showAppMessage === 'function') showAppMessage('Algunas verificaciones fallaron durante el refresco.', 'warning'); 
        } finally {
            if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false); 
            if (typeof updateGlobalLastCheckTime === 'function') updateGlobalLastCheckTime(new Date().toLocaleTimeString()); 
            console.log("app.js: checkAllStreams() finalizado.");
        }
    }

    // --- Iniciar la Aplicación ---
    initializeApp();
    console.log("app.js: initializeApp() ha sido invocada al final de DOMContentLoaded.");
});

console.log("app.js: Script finalizado (parseo inicial completo por el navegador). Esperando DOMContentLoaded.");
