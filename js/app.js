// AL INICIO DE js/app.js (antes de todo)
console.log("app.js: Script iniciado y parseado por el navegador.");

document.addEventListener('DOMContentLoaded', () => {
    console.log("app.js: Evento DOMContentLoaded disparado. El HTML está listo.");

    // --- Autenticación y Protección de Ruta ---
    // Estas funciones (isUserLoggedIn, logoutUser) deben estar definidas en auth.js y auth.js debe cargarse ANTES que app.js
    if (!isUserLoggedIn()) {
        console.warn('app.js: Usuario no autenticado. Redirigiendo a index.html...');
        window.location.href = 'index.html';
        return; // Detener la ejecución de este script si no está logueado
    }
    console.log("app.js: Usuario autenticado. Continuando con la inicialización de la app.");

    // --- Selectores de Elementos del DOM ---
    const fileInputControl = document.getElementById('fileInputControl');
    const checkStreamsButton = document.getElementById('checkStreamsButton');
    const logoutButton = document.getElementById('logoutButton');
    // Otros selectores ya están definidos en ui.js y son usados por sus funciones (ej. ui.updateFileNameDisplay)

    // --- Estado de la Aplicación ---
    let selectedFile = null;
    let monitoredStreams = []; // Array para almacenar la info de los streams que se están monitoreando
    let refreshIntervalId = null;
    const REFRESH_INTERVAL_MS = 60000 * 2; // Refrescar cada 2 minutos (ajustar según necesidad y cuotas de API)
    console.log("app.js: Variables de estado inicializadas.");

    // --- Inicialización ---
    function initializeApp() {
        console.log("app.js: initializeApp() llamada."); // PRIMERA LÍNEA DENTRO DE initializeApp
        // El tema ya se inicializa con theme.js
        // ui.js (cargado antes) ya podría haber manejado el mensaje de "no hay streams" en su propio DOMContentLoaded

        // Mostrar nombre de usuario (opcional)
        // const username = getAuthenticatedUsername(); // de auth.js
        // if (username) { console.log("app.js: Nombre de usuario obtenido:", username); /* ... actualizar UI ... */ }

        setupEventListeners();
        console.log("app.js: setupEventListeners() llamada desde initializeApp.");
        // Asegurar que el mensaje se muestre si no hay streams (ui.js debe estar cargado)
        if (typeof ui !== 'undefined' && typeof ui.showNoStreamsMessage === 'function') {
            ui.showNoStreamsMessage(monitoredStreams.length === 0);
        } else {
            console.error("app.js: El objeto 'ui' o 'ui.showNoStreamsMessage' no está disponible en initializeApp.");
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
                logoutUser(); // Función de auth.js
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
            if (typeof ui !== 'undefined' && typeof ui.updateFileNameDisplay === 'function') {
                ui.updateFileNameDisplay(selectedFile.name);
                ui.showAppMessage(`Archivo "${selectedFile.name}" seleccionado. Haz clic en "Verificar Streams".`, 'info', 7000);
            } else {
                console.error("app.js: 'ui.updateFileNameDisplay' o 'ui.showAppMessage' no disponible.");
            }
        } else {
            console.log("app.js: Ningún archivo seleccionado.");
            if (typeof ui !== 'undefined' && typeof ui.updateFileNameDisplay === 'function') {
                ui.updateFileNameDisplay(null);
            }
        }
    }

    async function handleCheckStreams() {
        console.log("app.js: handleCheckStreams() llamado.");
        if (!selectedFile) {
            console.warn("app.js: Intento de verificar streams sin archivo seleccionado.");
            if (typeof ui !== 'undefined' && typeof ui.showAppMessage === 'function') {
                ui.showAppMessage('Por favor, selecciona un archivo primero.', 'warning');
            }
            return;
        }

        if (typeof ui !== 'undefined') {
            ui.showLoadingIndicator(true);
            ui.clearStreamTable();
        }
        monitoredStreams = [];
        console.log("app.js: Tabla limpiada y streams monitoreados reseteados.");

        try {
            const fileContent = await selectedFile.text();
            console.log("app.js: Contenido del archivo leído.");
            const parsedInputs = parseInputLines(fileContent);
            console.log("app.js: Entradas parseadas del archivo:", parsedInputs);

            if (parsedInputs.length === 0) {
                console.warn("app.js: El archivo no contiene entradas válidas o está vacío.");
                if (typeof ui !== 'undefined') {
                    ui.showAppMessage('El archivo no contiene entradas válidas o está vacío.', 'warning');
                    ui.showNoStreamsMessage(true);
                }
                return; // Importante retornar aquí si no hay nada que procesar
            }
            
            if (typeof ui !== 'undefined') {
                ui.showAppMessage(`Procesando ${parsedInputs.length} entradas...`, 'info', 3000);
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
                if (typeof ui !== 'undefined' && typeof ui.addStreamToTable === 'function') {
                    ui.addStreamToTable(initialStreamInfo);
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
            if (typeof ui !== 'undefined' && typeof ui.showAppMessage === 'function') {
                ui.showAppMessage('Error al leer o procesar el archivo.', 'danger');
            }
        } finally {
            if (typeof ui !== 'undefined') {
                ui.showLoadingIndicator(false);
                ui.updateGlobalLastCheckTime(new Date().toLocaleTimeString());
            }
            console.log("app.js: handleCheckStreams() finalizado.");
        }
    }

    // --- Lógica de Parseo y Verificación de Streams ---
    function parseInputLines(textContent) {
        console.log("app.js: parseInputLines() llamado.");
        const lines = textContent.split(/\r?\n/);
        const inputs = [];
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine === '' || trimmedLine.startsWith('#')) return;
            let platform = 'unknown';
            let identifier = trimmedLine;
            if (trimmedLine.toLowerCase().includes('youtube.com/c/ChannelName2') || trimmedLine.toLowerCase().includes('youtube.com/c/ChannelName3')) {
                platform = 'youtube';
            } else if (trimmedLine.toLowerCase().includes('facebook.com/')) {
                platform = 'facebook';
            }
            inputs.push({ platform, identifier, originalInput: trimmedLine });
        });
        console.log("app.js: parseInputLines() completado. Entradas:", inputs);
        return inputs;
    }

    async function processStreamCheck(streamToUpdate, index) {
        console.log(`app.js: processStreamCheck() para [${index}] ${streamToUpdate.identifier} (${streamToUpdate.platform})`);
        let streamApiFunction;
        let platformKey = streamToUpdate.platform.toLowerCase();

        switch (platformKey) {
            case 'youtube':
                streamApiFunction = typeof getYouTubeStreamStatus === 'function' ? getYouTubeStreamStatus : window.getYouTubeStreamStatus;
                break;
            case 'facebook':
                streamApiFunction = typeof getFacebookStreamStatus === 'function' ? getFacebookStreamStatus : window.getFacebookStreamStatus;
                break;
            default:
                console.warn(`app.js: Plataforma no soportada: ${streamToUpdate.platform} para ${streamToUpdate.identifier}`);
                const unsupportedInfo = { ...streamToUpdate, status: 'No Soportado', lastCheck: new Date().toLocaleTimeString() };
                monitoredStreams[index] = unsupportedInfo;
                if (typeof ui !== 'undefined') ui.updateStreamRow(unsupportedInfo);
                return;
        }

        if (typeof streamApiFunction !== 'function') {
            console.error(`app.js: Función API no definida o no es una función para la plataforma: ${streamToUpdate.platform}. ¿Se cargó api_${platformKey}.js?`);
            const errorInfo = { ...streamToUpdate, status: 'Error Config.', lastCheck: new Date().toLocaleTimeString() };
            monitoredStreams[index] = errorInfo;
            if (typeof ui !== 'undefined') ui.updateStreamRow(errorInfo);
            return;
        }
        
        try {
            const updatedStreamInfoFromApi = await streamApiFunction(streamToUpdate.identifier);
            monitoredStreams[index] = {
                ...streamToUpdate, // Mantiene el originalInput y cualquier otra info base
                ...updatedStreamInfoFromApi, // Sobrescribe con la data fresca (name, status, title, etc.)
                identifier: updatedStreamInfoFromApi.identifier || streamToUpdate.identifier, // Asegurar que el identifier se mantenga o actualice
                platform: updatedStreamInfoFromApi.platform || streamToUpdate.platform, // Asegurar que la plataforma se mantenga
                lastCheck: new Date().toLocaleTimeString()
            };
            console.log(`app.js: Respuesta de API para ${monitoredStreams[index].identifier}:`, monitoredStreams[index]);
            if (typeof ui !== 'undefined') ui.updateStreamRow(monitoredStreams[index]);
        } catch (error) {
            console.error(`app.js: Error en API call para ${streamToUpdate.identifier}:`, error);
            const errorInfo = { ...streamToUpdate, status: 'Error API', lastCheck: new Date().toLocaleTimeString(), details: error.message };
            monitoredStreams[index] = errorInfo;
            if (typeof ui !== 'undefined') ui.updateStreamRow(errorInfo);
        }
    }

    async function checkAllStreams() {
        console.log("app.js: checkAllStreams() llamado.");
        if (monitoredStreams.length === 0) {
            console.log("app.js: No hay streams para verificar en checkAllStreams.");
            if (typeof ui !== 'undefined') ui.showNoStreamsMessage(true);
            return;
        }
        if (typeof ui !== 'undefined') ui.showLoadingIndicator(true);
        
        const promises = monitoredStreams.map((stream, index) => processStreamCheck(stream, index));
        
        try {
            await Promise.all(promises);
            console.log("app.js: Todas las promesas de processStreamCheck resueltas.");
        } catch (error) {
            console.error("app.js: Error durante Promise.all en checkAllStreams:", error);
            if (typeof ui !== 'undefined') ui.showAppMessage('Algunas verificaciones fallaron durante el refresco.', 'warning');
        } finally {
            if (typeof ui !== 'undefined') {
                ui.showLoadingIndicator(false);
                ui.updateGlobalLastCheckTime(new Date().toLocaleTimeString());
            }
            console.log("app.js: checkAllStreams() finalizado.");
        }
    }

    // --- Iniciar la Aplicación ---
    initializeApp();
    console.log("app.js: initializeApp() ha sido invocada.");
});

console.log("app.js: Script finalizado (parseo inicial completo por el navegador). Esperando DOMContentLoaded.");