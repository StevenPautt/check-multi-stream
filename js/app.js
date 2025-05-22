/**
 * app.js
 * Orquesta la lógica principal de la aplicación Check Multi-Stream en main.html.
 * Maneja eventos, llamadas a APIs (a través de módulos) y actualizaciones de UI (a través de ui.js).
 */

// Asegurarse de que el DOM está completamente cargado
document.addEventListener('DOMContentLoaded', () => {
    // --- Autenticación y Protección de Ruta ---
    if (!isUserLoggedIn()) { // Función de auth.js
        console.warn('Usuario no autenticado. Redirigiendo al login...');
        window.location.href = 'index.html';
        return; // Detener la ejecución de este script si no está logueado
    }

    // --- Selectores de Elementos del DOM ---
    const fileInputControl = document.getElementById('fileInputControl');
    const checkStreamsButton = document.getElementById('checkStreamsButton');
    const logoutButton = document.getElementById('logoutButton');
    // Otros selectores ya están definidos en ui.js y son usados por sus funciones

    // --- Estado de la Aplicación ---
    let selectedFile = null;
    let monitoredStreams = []; // Array para almacenar la info de los streams que se están monitoreando
    let refreshIntervalId = null;
    const REFRESH_INTERVAL_MS = 60000 * 2; // Refrescar cada 2 minutos (ajustar según necesidad y cuotas de API)

    // --- Inicialización ---
    functioninitializeApp() {
        // El tema ya se inicializa con theme.js
        // ui.js ya muestra el mensaje de "no hay streams" si la tabla está vacía al cargar
        
        // Mostrar nombre de usuario (opcional, si tienes dónde ponerlo en el header)
        // const username = getAuthenticatedUsername(); // de auth.js
        // if (username) { /* ... actualizar UI ... */ }

        setupEventListeners();
        // No cargamos streams al inicio a menos que los guardemos en localStorage,
        // lo cual no está implementado en esta versión para mantenerlo simple.
        // Se espera que el usuario cargue un archivo.
        ui.showNoStreamsMessage(true); // Asegurar que el mensaje se muestre al inicio
    }

    // --- Manejadores de Eventos ---
    function setupEventListeners() {
        if (fileInputControl) {
            fileInputControl.addEventListener('change', handleFileSelect);
        }
        if (checkStreamsButton) {
            checkStreamsButton.addEventListener('click', handleCheckStreams);
        }
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                if (refreshIntervalId) {
                    clearInterval(refreshIntervalId); // Detener refresco al hacer logout
                }
                logoutUser(); // Función de auth.js
            });
        }
    }

    function handleFileSelect(event) {
        selectedFile = event.target.files[0];
        if (selectedFile) {
            ui.updateFileNameDisplay(selectedFile.name); // de ui.js
            ui.showAppMessage(`Archivo "${selectedFile.name}" seleccionado. Haz clic en "Verificar Streams".`, 'info', 7000);
        } else {
            ui.updateFileNameDisplay(null); // de ui.js
        }
    }

    async function handleCheckStreams() {
        if (!selectedFile) {
            ui.showAppMessage('Por favor, selecciona un archivo primero.', 'warning'); // de ui.js
            return;
        }

        ui.showLoadingIndicator(true); // de ui.js
        ui.clearStreamTable();       // de ui.js
        monitoredStreams = [];       // Resetear lista de streams monitoreados

        try {
            const fileContent = await selectedFile.text();
            const parsedInputs = parseInputLines(fileContent);

            if (parsedInputs.length === 0) {
                ui.showAppMessage('El archivo no contiene entradas válidas o está vacío.', 'warning');
                ui.showNoStreamsMessage(true);
                return;
            }
            
            ui.showAppMessage(`Procesando ${parsedInputs.length} entradas...`, 'info', 3000);

            // Procesar cada entrada y añadirla a la UI inicialmente como "Pendiente" o similar
            // Luego, las verificaciones reales las actualizarán.
            parsedInputs.forEach(input => {
                const initialStreamInfo = {
                    platform: input.platform || 'unknown',
                    identifier: input.identifier,
                    name: input.originalInput, // Usar el input original como nombre temporal
                    status: 'Pendiente...',
                    lastCheck: '-'
                };
                monitoredStreams.push(initialStreamInfo); // Añadir a la lista para monitoreo
                ui.addStreamToTable(initialStreamInfo); // Añadir a la tabla inmediatamente
            });

            // Iniciar la primera verificación de todos los streams
            await checkAllStreams();

            // Configurar el refresco automático
            if (refreshIntervalId) {
                clearInterval(refreshIntervalId);
            }
            refreshIntervalId = setInterval(checkAllStreams, REFRESH_INTERVAL_MS);

        } catch (error) {
            console.error('Error procesando el archivo:', error);
            ui.showAppMessage('Error al leer o procesar el archivo.', 'danger');
        } finally {
            ui.showLoadingIndicator(false); // de ui.js
            ui.updateGlobalLastCheckTime(new Date().toLocaleTimeString()); // de ui.js
        }
    }

    // --- Lógica de Parseo y Verificación de Streams ---

    /**
     * Parsea el contenido de texto del archivo en objetos de entrada.
     * @param {string} textContent - El contenido del archivo.
     * @returns {Array<object>} Array de objetos { platform: string, identifier: string, originalInput: string }
     */
    function parseInputLines(textContent) {
        const lines = textContent.split(/\r?\n/); // Dividir por saltos de línea
        const inputs = [];

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine === '' || trimmedLine.startsWith('#')) { // Ignorar líneas vacías o comentarios
                return;
            }

            let platform = 'unknown';
            let identifier = trimmedLine; // Por defecto, el identificador es la línea completa

            // Detección básica de plataforma (puede mejorarse mucho con regex más robustos)
            if (trimmedLine.toLowerCase().includes('youtube.com/') || trimmedLine.toLowerCase().includes('youtu.be/')) {
                platform = 'youtube';
                // Idealmente, aquí llamarías a una función más robusta de api_youtube.js para extraer el ID/handle
                // Por ahora, pasamos la URL completa y dejamos que la función de API intente parsearla.
                identifier = trimmedLine; 
            } else if (trimmedLine.toLowerCase().includes('facebook.com/')) {
                platform = 'facebook';
                // Similar para Facebook, pasar la URL para que la API la parsee.
                identifier = trimmedLine;
            }
            // Podrías añadir más 'else if' para otras plataformas como Twitch

            inputs.push({
                platform: platform,
                identifier: identifier, // Este es el ID/URL/Handle que se pasará a la función de API
                originalInput: trimmedLine // Guardar la línea original para mostrar si es necesario
            });
        });
        return inputs;
    }

    /**
     * Procesa la verificación de estado para un solo stream y actualiza la UI.
     * @param {object} streamToUpdate - El objeto de stream de monitoredStreams.
     * @param {number} index - El índice del stream en monitoredStreams para actualizarlo.
     */
    async function processStreamCheck(streamToUpdate, index) {
        let streamApiFunction;

        switch (streamToUpdate.platform.toLowerCase()) {
            case 'youtube':
                streamApiFunction = window.getYouTubeStreamStatus; // Asume que está global o importada
                break;
            case 'facebook':
                streamApiFunction = window.getFacebookStreamStatus; // Asume que está global o importada
                break;
            // case 'twitch': streamApiFunction = window.getTwitchStreamStatus; break;
            default:
                console.warn(`Plataforma no soportada para: ${streamToUpdate.identifier}`);
                const unsupportedInfo = {
                    ...streamToUpdate,
                    status: 'No Soportado',
                    lastCheck: new Date().toLocaleTimeString()
                };
                monitoredStreams[index] = unsupportedInfo;
                ui.updateStreamRow(unsupportedInfo);
                return;
        }

        if (typeof streamApiFunction !== 'function') {
            console.error(`Función API no definida para la plataforma: ${streamToUpdate.platform}`);
            const errorInfo = { ...streamToUpdate, status: 'Error Config.', lastCheck: new Date().toLocaleTimeString() };
            monitoredStreams[index] = errorInfo;
            ui.updateStreamRow(errorInfo);
            return;
        }
        
        try {
            // La función de API debería tomar el 'identifier' (que es la URL o ID crudo)
            // y devolver el objeto streamInfo completo, incluyendo el 'name' parseado.
            const updatedStreamInfo = await streamApiFunction(streamToUpdate.identifier); 
            
            // Combinar/actualizar la información en nuestro array `monitoredStreams`
            // La función de API ya debería devolver el objeto con 'platform' y el 'identifier' original o procesado.
            monitoredStreams[index] = {
                ...streamToUpdate, // Mantener información original si es necesario
                ...updatedStreamInfo, // Sobrescribir con la data fresca de la API
                lastCheck: new Date().toLocaleTimeString() // Asegurar que la hora de chequeo es la actual
            };
            ui.updateStreamRow(monitoredStreams[index]);
        } catch (error) {
            console.error(`Error al verificar stream ${streamToUpdate.identifier}:`, error);
            const errorInfo = { ...streamToUpdate, status: 'Error API', lastCheck: new Date().toLocaleTimeString() };
            monitoredStreams[index] = errorInfo;
            ui.updateStreamRow(errorInfo);
        }
    }

    /**
     * Verifica el estado de todos los streams monitoreados.
     */
    async function checkAllStreams() {
        if (monitoredStreams.length === 0) {
            // console.log('No hay streams para verificar en el refresco.');
            // ui.showNoStreamsMessage(true); // Opcional: si la tabla está vacía, mostrar mensaje
            return;
        }

        ui.showLoadingIndicator(true);
        // console.log('Iniciando refresco de todos los streams...');
        // Usar Promise.all para ejecutar todas las verificaciones en "paralelo" (concurrente)
        // Mapeamos cada stream a la promesa de su verificación
        const promises = monitoredStreams.map((stream, index) => processStreamCheck(stream, index));
        
        try {
            await Promise.all(promises);
            // console.log('Todos los streams han sido verificados.');
        } catch (error) {
            // Aunque processStreamCheck ya maneja errores individuales,
            // Promise.all podría fallar si una promesa es rechazada y no se maneja internamente.
            console.error("Ocurrió un error durante la verificación de todos los streams:", error);
            ui.showAppMessage('Algunas verificaciones fallaron durante el refresco.', 'warning');
        } finally {
            ui.showLoadingIndicator(false);
            ui.updateGlobalLastCheckTime(new Date().toLocaleTimeString());
        }
    }

    // --- Iniciar la Aplicación ---
    initializeApp();
});