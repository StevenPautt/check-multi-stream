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
    let monitoredStreams = []; // Almacena objetos { platform, identifier (para API), name (para display), originalInput (para ID de fila), status, lastCheck, title, details }
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
        monitoredStreams = []; // Resetear lista de streams monitoreados
        console.log("app.js: Tabla limpiada y streams monitoreados reseteados.");

        try {
            console.log("app.js: Contenido del área de texto (primeros 200 caracteres):", textContent.substring(0, 200));
            const parsedInputs = parseInputLines(textContent); // Esta es tu función parseInputLines que ya funciona
            console.log("app.js: Entradas parseadas del área de texto:", JSON.parse(JSON.stringify(parsedInputs)));

            if (parsedInputs.length === 0) {
                console.warn("app.js: El área de texto no contiene entradas válidas o está vacía después de parsear.");
                if (typeof showAppMessage === 'function') showAppMessage('No se encontraron URLs válidas en el texto ingresado.', 'warning');
                if (typeof showNoStreamsMessage === 'function') showNoStreamsMessage(true);
                if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false); // Ocultar si no hay nada que hacer
                return;
            }

            if (typeof showAppMessage === 'function') {
                showAppMessage(`Procesando ${parsedInputs.length} entradas...`, 'info', 3000);
            }

            parsedInputs.forEach(input => {
                // input de parseInputLines es { platform, identifier (URL limpia), originalInput (URL trimeada) }
                const streamInfo = {
                    platform: input.platform || 'unknown',
                    identifier: input.identifier,      // Este es el identificador para la API (URL limpia)
                    name: input.originalInput,         // Nombre inicial para mostrar (la URL original trimeada)
                    originalInput: input.originalInput, // Clave estable para el ID de la fila DOM
                    status: 'Pendiente...',
                    lastCheck: '-',
                    title: null, // Se llenará con la respuesta de la API
                    details: null // Para mensajes de error
                };
                monitoredStreams.push(streamInfo);
                if (typeof addStreamToTable === 'function') {
                    addStreamToTable(streamInfo); // ui.js usará originalInput para el ID de la fila
                }
            });
            console.log("app.js: Streams iniciales añadidos a la tabla y a monitoredStreams.");

            await checkAllStreams();
            console.log("app.js: Verificación inicial de todos los streams completada.");

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
            if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false);
        } finally {
            // El showLoadingIndicator(false) se maneja mejor dentro de checkAllStreams
            // o aquí si hubo un error antes de llamar a checkAllStreams
            if (monitoredStreams.length > 0 && typeof showLoadingIndicator === 'function' && !refreshIntervalId) {
                 // Si hubo un error antes de la primera llamada a checkAllStreams, el spinner podría quedar activo
            }
            if (typeof updateGlobalLastCheckTime === 'function') updateGlobalLastCheckTime(new Date().toLocaleTimeString());
            console.log("app.js: handleCheckStreams() finalizado.");
        }
    }

    // Tu función parseInputLines (la que te funciona para detectar plataformas)
    function parseInputLines(textContent) {
        console.log("app.js: parseInputLines() INICIO.");
        const lines = textContent.split(/\r?\n/);
        const inputs = [];

        lines.forEach((line, index) => {
            let processedLine = line.trim();
            // Tu lógica de limpieza:
            if (processedLine.endsWith('[Object Object]')) {
                console.warn(`DEBUG: Línea ${index + 1} - Se detectó "[Object Object]" al final. Limpiando.`);
                processedLine = processedLine.slice(0, -15).trim();
                console.log(`DEBUG: Línea ${index + 1} (después de limpiar "[Object Object]"): [${processedLine}]`);
            }

            const parts = processedLine.split(/\s+/);
            if (parts.length > 1 && parts[0].toLowerCase().startsWith('http')) {
                console.warn(`DEBUG: Línea ${index + 1} - Espacios detectados después de la URL inicial. Usando solo la primera parte: "${parts[0]}"`);
                processedLine = parts[0];
                console.log(`DEBUG: Línea ${index + 1} (después de tomar primera parte si hay espacios): [${processedLine}]`);
            }

            if (processedLine === '' || processedLine.startsWith('#')) {
                console.log(`DEBUG: Línea ${index + 1} ignorada (vacía o comentario).`);
                return; 
            }

            const lowerLine = processedLine.toLowerCase();
            let platform = 'unknown';

            console.log(`DEBUG: Línea ${index + 1} (finalLineToProcess para detección): [${processedLine}] (lowerLine: [${lowerLine}])`);


            if (lowerLine.includes('twitch.tv/')) platform = 'twitch';
            else if (lowerLine.includes('youtube.com/') || lowerLine.includes('youtu.be/')) platform = 'youtube';
            else if (lowerLine.includes('kick.com/')) platform = 'kick';
            else if (lowerLine.includes('facebook.com/')) platform = 'facebook';
            
            console.log(`DEBUG: Línea ${index + 1} - Plataforma final detectada: ${platform}`);
            inputs.push({
                originalInput: processedLine, // Usar la línea ya trimeada y potencialmente limpiada
                identifier: processedLine,    // Usar la línea ya trimeada y potencialmente limpiada
                platform: platform
            });
        });

        console.log("app.js: parseInputLines() FIN. Entradas detectadas:", JSON.parse(JSON.stringify(inputs)));
        return inputs;
    }


    async function processStreamCheck(streamToUpdate, index) {
        // streamToUpdate viene de monitoredStreams, ya tiene originalInput, platform, etc.
        console.log(`app.js: processStreamCheck() para [${index}] (Original: ${streamToUpdate.originalInput}, ID actual para API: ${streamToUpdate.identifier}) (${streamToUpdate.platform})`);
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
                console.warn(`app.js: Plataforma no soportada: ${streamToUpdate.platform} para ${streamToUpdate.originalInput}`);
                const unsupportedInfo = { 
                    ...streamToUpdate, 
                    status: 'No Soportado', 
                    lastCheck: new Date().toLocaleTimeString() 
                };
                monitoredStreams[index] = unsupportedInfo; // Actualizar en el array global
                if (typeof updateStreamRow === 'function') updateStreamRow(unsupportedInfo);
                return;
        }

        if (!streamApiFunction) {
            console.error(`app.js: Función API no definida para ${streamToUpdate.platform}. ¿Se cargó api_${platformKey}.js?`);
            const errorConfigInfo = { 
                ...streamToUpdate, 
                status: 'Error Config.', 
                lastCheck: new Date().toLocaleTimeString() 
            };
            monitoredStreams[index] = errorConfigInfo; // Actualizar en el array global
            if (typeof updateStreamRow === 'function') updateStreamRow(errorConfigInfo);
            return;
        }
        
        try {
            // La función de API (ej. getYouTubeStreamStatus) recibe el 'identifier'
            // que es la URL potencialmente limpiada por parseInputLines.
            // Debería devolver un objeto que incluya:
            // - name (ej. título del canal)
            // - identifier (ej. Channel ID resuelto)
            // - status ('Live', 'Offline', 'Error')
            // - platform (debería ser la misma que se le pasó o la que determine la API)
            // - title (título del stream, opcional)
            // - details (detalles de error, opcional)
            const apiResponse = await streamApiFunction(streamToUpdate.identifier); 

            monitoredStreams[index] = {
                ...streamToUpdate, // Preserva 'originalInput' de streamToUpdate
                name: apiResponse.name || streamToUpdate.name, // Prioriza nombre de API, sino el original (URL)
                identifier: apiResponse.identifier || streamToUpdate.identifier, // Prioriza ID de API, sino el original (URL)
                status: apiResponse.status || 'Error Desconocido',
                title: apiResponse.title,
                details: apiResponse.details,
                platform: apiResponse.platform || streamToUpdate.platform, // Asegurar que la plataforma se mantenga
                lastCheck: new Date().toLocaleTimeString()
            };
            
            console.log(`app.js: Respuesta de API para ${monitoredStreams[index].originalInput}:`, JSON.parse(JSON.stringify(monitoredStreams[index])));
            if (typeof updateStreamRow === 'function') updateStreamRow(monitoredStreams[index]);
        } catch (error) {
            console.error(`app.js: Error en API call para ${streamToUpdate.originalInput}:`, error);
            const errorApiInfo = { 
                ...streamToUpdate, 
                status: 'Error API', 
                lastCheck: new Date().toLocaleTimeString(), 
                details: error.message 
            };
            monitoredStreams[index] = errorApiInfo; // Actualizar en el array global
            if (typeof updateStreamRow === 'function') updateStreamRow(errorApiInfo);
        }
    }

    async function checkAllStreams() {
        console.log("app.js: checkAllStreams() llamado.");
        if (monitoredStreams.length === 0) {
            console.log("app.js: No hay streams para verificar en checkAllStreams.");
            if (typeof showNoStreamsMessage === 'function') showNoStreamsMessage(true);
             if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false); // Ocultar si no hay nada que hacer
            return;
        }
        if (typeof showLoadingIndicator === 'function') showLoadingIndicator(true);

        const promises = monitoredStreams.map((stream, index) => processStreamCheck(stream, index));

        try {
            await Promise.all(promises);
            console.log("app.js: Todas las promesas de processStreamCheck resueltas.");
        } catch (error) {
            // Este catch es por si Promise.all mismo falla, aunque los errores individuales
            // ya se manejan dentro de processStreamCheck.
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