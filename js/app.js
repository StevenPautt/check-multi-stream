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
    const urlInputArea = document.getElementById('urlInputArea');
    const checkStreamsButton = document.getElementById('checkStreamsButton');
    const logoutButton = document.getElementById('logoutButton');

    // --- Estado de la Aplicación ---
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

    async function handleCheckStreams() {
        console.log("app.js: handleCheckStreams() llamado.");

        if (!urlInputArea) {
            console.error("app.js: Elemento urlInputArea no encontrado.");
            if (typeof showAppMessage === 'function') {
                showAppMessage('Error interno: No se encontró el área de texto para URLs.', 'danger');
            }
            return;
        }

        const textContent = urlInputArea.value;

        if (!textContent.trim()) {
            console.warn("app.js: Intento de verificar streams sin URLs en el área de texto.");
            if (typeof showAppMessage === 'function') {
                showAppMessage('Por favor, pega algunas URLs en el área de texto primero.', 'warning');
            }
            return;
        }

        if (typeof showLoadingIndicator === 'function') showLoadingIndicator(true);
        if (typeof clearStreamTable === 'function') clearStreamTable();
        monitoredStreams = [];
        console.log("app.js: Tabla limpiada y streams monitoreados reseteados.");

        try {
            console.log("app.js: Contenido del área de texto (primeros 200 caracteres):", textContent.substring(0, 200));
            const parsedInputs = parseInputLines(textContent);
            console.log("app.js: Entradas parseadas:", parsedInputs);

            if (parsedInputs.length === 0) {
                console.warn("app.js: No se encontraron entradas válidas.");
                if (typeof showAppMessage === 'function') showAppMessage('No se encontraron URLs válidas en el texto ingresado.', 'warning');
                if (typeof showNoStreamsMessage === 'function') showNoStreamsMessage(true);
                return;
            }

            if (typeof showAppMessage === 'function') {
                showAppMessage(`Procesando ${parsedInputs.length} entradas...`, 'info', 3000);
            }

            parsedInputs.forEach(input => {
                const streamInfo = { // Cambiado de initialStreamInfo para consistencia con tu código
                    platform: input.platform || 'unknown',
                    identifier: input.identifier,
                    name: input.originalInput,
                    status: 'Pendiente...',
                    lastCheck: '-'
                };
                monitoredStreams.push(streamInfo);
                if (typeof addStreamToTable === 'function') {
                    addStreamToTable(streamInfo);
                }
            });

            console.log("app.js: Streams añadidos a la tabla."); // Cambiado de "Streams iniciales añadidos..."

            await checkAllStreams(); // Esta llamada ahora debería funcionar
            console.log("app.js: Verificación inicial completa."); // Cambiado de "Primera verificación..."

            if (refreshIntervalId) clearInterval(refreshIntervalId);
            refreshIntervalId = setInterval(checkAllStreams, REFRESH_INTERVAL_MS);
            console.log("app.js: Intervalo de refresco iniciado."); // Cambiado de "Intervalo de refresco configurado..."

        } catch (error) {
            console.error("app.js: Error procesando streams:", error); // Cambiado de "Error procesando el contenido..."
            if (typeof showAppMessage === 'function') {
                showAppMessage('Error al procesar las URLs ingresadas.', 'danger');
            }
        } finally {
            if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false);
            if (typeof updateGlobalLastCheckTime === 'function') updateGlobalLastCheckTime(new Date().toLocaleTimeString());
            console.log("app.js: handleCheckStreams() finalizado.");
        }
    }

    // --- Tu función parseInputLines modificada ---
    function parseInputLines(textContent) {
        console.log("app.js: parseInputLines() INICIO.");
        const lines = textContent.split(/\r?\n/);
        const inputs = [];

        lines.forEach((line, index) => {
            let processedLine = line.trim();
            if (processedLine.endsWith('[Object Object]')) {
                processedLine = processedLine.slice(0, -15).trim();
            }

            const parts = processedLine.split(/\s+/);
            if (parts.length > 1 && parts[0].startsWith('http')) {
                processedLine = parts[0];
            }

            if (processedLine === '' || processedLine.startsWith('#')) {
                return; // Salta esta iteración del bucle forEach
            }

            const lowerLine = processedLine.toLowerCase();
            let platform = 'unknown';

            // Tu lógica de detección de plataformas que te funciona:
            if (lowerLine.includes('twitch.tv/')) platform = 'twitch';
            else if (lowerLine.includes('youtube.com/') || lowerLine.includes('youtu.be/')) platform = 'youtube';
            else if (lowerLine.includes('kick.com/')) platform = 'kick';
            else if (lowerLine.includes('facebook.com/')) platform = 'facebook';

            inputs.push({
                originalInput: processedLine, // Usar processedLine que es la URL limpia
                identifier: processedLine,    // Usar processedLine que es la URL limpia
                platform: platform
            });
        });

        console.log("app.js: parseInputLines() FIN.");
        return inputs;
    }

    // --- FUNCIONES REINSERTADAS ---
    async function processStreamCheck(streamToUpdate, index) {
        console.log(`app.js: processStreamCheck() para [${index}] (ID para API: ${streamToUpdate.identifier}, Mostrado: ${streamToUpdate.name}) (${streamToUpdate.platform})`);
        let streamApiFunction;
        let platformKey = streamToUpdate.platform.toLowerCase();

        switch (platformKey) {
            case 'youtube':
                streamApiFunction = typeof getYouTubeStreamStatus === 'function' ? getYouTubeStreamStatus : null;
                break;
            case 'facebook':
                streamApiFunction = typeof getFacebookStreamStatus === 'function' ? getFacebookStreamStatus : null;
                break;
            case 'twitch':
                streamApiFunction = typeof getTwitchStreamStatus === 'function' ? getTwitchStreamStatus : null;
                break;
            case 'kick':
                streamApiFunction = typeof getKickStreamStatus === 'function' ? getKickStreamStatus : null;
                break;
            default:
                console.warn(`app.js: Plataforma no soportada: ${streamToUpdate.platform} para ${streamToUpdate.name}`);
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
                name: updatedStreamInfoFromApi.name || streamToUpdate.name, // Asegurar que el nombre se actualice si la API lo provee
                lastCheck: new Date().toLocaleTimeString()
            };
            console.log(`app.js: Respuesta de API para ${monitoredStreams[index].name}:`, JSON.parse(JSON.stringify(monitoredStreams[index])));
            if (typeof updateStreamRow === 'function') updateStreamRow(monitoredStreams[index]);
        } catch (error) {
            console.error(`app.js: Error en API call para ${streamToUpdate.name}:`, error);
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
    // --- FIN DE FUNCIONES REINSERTADAS ---

    // Iniciar la app
    initializeApp();
});

// AL FINAL DE js/app.js
console.log("app.js: Script finalizado (parseo inicial completo por el navegador). Esperando DOMContentLoaded."); // Movido aquí