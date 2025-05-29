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

        const textContent = urlInputArea.value; // No hacer trim() aquí, parseInputLines lo hará por línea

        if (!textContent.trim()) { // Verificar si después de trim general, está vacío
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
            console.log("app.js: Contenido del área de texto (primeros 200 caracteres):", textContent.substring(0,200));
            const parsedInputs = parseInputLines(textContent);
            console.log("app.js: Entradas parseadas del área de texto (después de llamar a parseInputLines):", JSON.parse(JSON.stringify(parsedInputs)));

            if (parsedInputs.length === 0) {
                console.warn("app.js: El área de texto no contiene entradas válidas o está vacía después de parsear.");
                if (typeof showAppMessage === 'function') showAppMessage('No se encontraron URLs válidas en el texto ingresado.', 'warning');
                if (typeof showNoStreamsMessage === 'function') showNoStreamsMessage(true);
                return;
            }

            if (typeof showAppMessage === 'function') {
                showAppMessage(`Procesando ${parsedInputs.length} entradas...`, 'info', 3000);
            }

            parsedInputs.forEach(input => {
                const initialStreamInfo = {
                    platform: input.platform || 'unknown',
                    identifier: input.identifier, // Este será el identificador limpio
                    name: input.originalInput,   // Este es el input original trimeado de la línea
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
            console.error('app.js: Error procesando el contenido del área de texto en handleCheckStreams:', error);
            if (typeof showAppMessage === 'function') {
                showAppMessage('Error al procesar las URLs ingresadas.', 'danger');
            }
        } finally {
            if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false);
            if (typeof updateGlobalLastCheckTime === 'function') updateGlobalLastCheckTime(new Date().toLocaleTimeString());
            console.log("app.js: handleCheckStreams() finalizado.");
        }
    }

    // --- Lógica de Parseo y Verificación de Streams ---
    function parseInputLines(textContent) {
        console.log("app.js: parseInputLines() INICIO.");
        const lines = textContent.split(/\r?\n/);
        const inputs = [];
        lines.forEach((line, index) => {
            const originalLineFromTextarea = line;
            let processedLine = line.trim(); 

            console.log(`DEBUG: Línea ${index + 1} (original): [${originalLineFromTextarea}] (Longitud: ${originalLineFromTextarea.length})`);
            console.log(`DEBUG: Línea ${index + 1} (después de trim()): [${processedLine}] (Longitud: ${processedLine.length})`);
            
            // --- INICIO DE LIMPIEZA AGRESIVA ---
            // Intento 1: Eliminar si termina con "[Object Object]" (común al copiar de consolas)
            const objectObjectString = "[Object Object]";
            if (processedLine.endsWith(objectObjectString)) {
                console.warn(`DEBUG: Línea ${index + 1} - Se detectó "${objectObjectString}" al final. Limpiando.`);
                processedLine = processedLine.substring(0, processedLine.length - objectObjectString.length).trim();
                console.log(`DEBUG: Línea ${index + 1} (después de limpiar "${objectObjectString}"): [${processedLine}] (Longitud: ${processedLine.length})`);
            }

            // Intento 2: Quedarse solo con la primera "palabra" si parece una URL y hay espacios después
            // Esto asume que la URL es lo primero en la línea.
            const parts = processedLine.split(/\s+/); // Dividir por uno o más espacios
            if (parts.length > 0 && (parts[0].toLowerCase().startsWith('http://') || parts[0].toLowerCase().startsWith('https://'))) {
                if (parts.length > 1) {
                     console.warn(`DEBUG: Línea ${index + 1} - Espacios detectados después de la URL inicial. Usando solo la primera parte: "${parts[0]}"`);
                }
                processedLine = parts[0]; // Tomar solo la primera parte (la URL)
                 console.log(`DEBUG: Línea ${index + 1} (después de tomar primera parte si hay espacios): [${processedLine}] (Longitud: ${processedLine.length})`);
            }
            // --- FIN DE LIMPIEZA AGRESIVA ---

            const finalLineToProcess = processedLine;

            if (finalLineToProcess === '' || finalLineToProcess.startsWith('#')) {
                console.log(`DEBUG: Línea ${index + 1} ignorada (vacía o comentario).`);
                return;
            }

            if (finalLineToProcess.length > 0) {
                const lastChars = finalLineToProcess.slice(-5); 
                let charDetails = "";
                for (let i = 0; i < lastChars.length; i++) {
                    charDetails += `'${lastChars[i]}' (código: ${lastChars[i].charCodeAt(0)}) `;
                }
                console.log(`DEBUG: Línea ${index + 1} finalLineToProcess - Últimos 5 chars: ${charDetails.trim()}`);
            }
            
            const lowerLine = finalLineToProcess.toLowerCase();
            console.log(`DEBUG: Línea ${index + 1} (lowerLine, basada en finalLineToProcess): [${lowerLine}] (Longitud: ${lowerLine.length})`);

            if (finalLineToProcess.length > 0 && lowerLine.length > 0) {
                const lastCharsLower = lowerLine.slice(-5); 
                let charDetailsLower = "";
                for (let i = 0; i < lastCharsLower.length; i++) {
                    charDetailsLower += `'${lastCharsLower[i]}' (código: ${lastCharsLower[i].charCodeAt(0)}) `;
                }
                console.log(`DEBUG: Línea ${index + 1} lowerLine - Últimos 5 chars: ${charDetailsLower.trim()}`);
            }
            
            let platform = 'unknown';
            // Usar finalLineToProcess para el identificador que se pasará a las APIs
            let identifierForApi = finalLineToProcess; 

            const includesYouTube = lowerLine.includes('youtube.com/c/ChannelName6') || lowerLine.includes('youtu.be/');
            const includesTwitch = lowerLine.includes('twitch.tv/');
            const includesKick = lowerLine.includes('kick.com/');
            const includesFacebook = lowerLine.includes('facebook.com/');

            console.log(`DEBUG: Línea ${index + 1} - Resultados de .includes(): YouTube=${includesYouTube}, Twitch=${includesTwitch}, Kick=${includesKick}, Facebook=${includesFacebook}`);

            if (includesTwitch) {
                platform = 'twitch';
            } else if (includesKick) {
                platform = 'kick';
            } else if (includesYouTube) { 
                platform = 'youtube';
            } else if (includesFacebook) {
                platform = 'facebook';
            }
            
            console.log(`DEBUG: Línea ${index + 1} - Plataforma final detectada: ${platform}`);
            // Guardar el originalInput trimeado (antes de la limpieza agresiva) para mostrarlo,
            // pero usar el identifierForApi (finalLineToProcess) para las llamadas a API.
            inputs.push({ platform, identifier: identifierForApi, originalInput: line.trim() });
        });
        console.log("app.js: parseInputLines() FIN. Entradas detectadas:", JSON.parse(JSON.stringify(inputs)));
        return inputs;
    }

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
            // Pasamos el 'identifier' que es la URL limpia a la función de API
            const updatedStreamInfoFromApi = await streamApiFunction(streamToUpdate.identifier); 

            monitoredStreams[index] = {
                ...streamToUpdate, // Mantiene el originalInput (name)
                ...updatedStreamInfoFromApi, // Sobrescribe con la data fresca (status, title, etc.)
                                             // y puede refinar 'name' y 'identifier' si la API lo hace.
                identifier: updatedStreamInfoFromApi.identifier || streamToUpdate.identifier,
                platform: updatedStreamInfoFromApi.platform || streamToUpdate.platform,
                lastCheck: new Date().toLocaleTimeString()
            };
            // Si la API no devuelve 'name', el 'name' original (que es originalInput) se mantendrá.
            // Es importante que updatedStreamInfoFromApi devuelva un 'name' si lo puede determinar mejor.
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

    // --- Iniciar la Aplicación ---
    initializeApp();
    console.log("app.js: initializeApp() ha sido invocada al final de DOMContentLoaded.");
});

console.log("app.js: Script finalizado (parseo inicial completo por el navegador). Esperando DOMContentLoaded.");