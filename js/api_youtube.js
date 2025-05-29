/**
 * api_youtube.js
 * Contiene la lógica conceptual para interactuar con la API de YouTube
 * y verificar el estado de los streams.
 *
 * IMPORTANTE: Este código es conceptual. Necesitarás tu propia API Key
 * y deberás manejar la autenticación y los errores de forma robusta.
 */

// DEBERÍAS OBTENER ESTA CLAVE DESDE GOOGLE CLOUD CONSOLE Y GESTIONARLA DE FORMA SEGURA.
// Para pruebas iniciales, puedes ponerla aquí, pero NUNCA la subas a un repositorio público.
// Considera restringir la clave API a tus dominios específicos.
const YOUTUBE_API_KEY = 'AIzaSyDbK-imV7m7JGs3bWlij7ovM4FpyN9Zpxg';

/**
 * Extrae el ID de un canal de YouTube desde una URL.
 * Esta es una función simplificada y podría necesitar mejoras para cubrir todos los formatos de URL.
 * @param {string} urlOrId - La URL del canal o el ID del canal.
 * @returns {string|null} El ID del canal o null si no se puede extraer.
 */
function getYouTubeChannelId(urlOrId) {
    if (!urlOrId) return null;

    // Si ya es un ID de canal (usualmente empieza con UC y tiene 24 caracteres)
    if (urlOrId.startsWith('UC') && urlOrId.length === 24) {
        return urlOrId;
    }

    try {
        const url = new URL(urlOrId);
        // Formatos comunes: youtube.com/channel/ID, youtube.com/c/NombrePersonalizado, youtube.com/@NombreUsuario
        if (url.hostname.includes('youtube.com')) {
            const pathParts = url.pathname.split('/').filter(part => part.length > 0);
            if (pathParts.length > 0) {
                if (pathParts[0] === 'channel' && pathParts[1]) {
                    return pathParts[1]; // ID directo del canal
                }
                if (pathParts[0] === 'c' && pathParts[1]) {
                    // Para URLs con /c/NombrePersonalizado, necesitarías una llamada adicional a la API
                    // para resolver el NombrePersonalizado a un ID de canal.
                    // Por simplicidad aquí, devolveremos el nombre para que app.js decida.
                    // O puedes marcarlo para que app.js sepa que necesita resolución.
                    console.warn('URLs de YouTube con /c/ requieren resolución adicional para obtener Channel ID.');
                    return `custom_url:${pathParts[1]}`; // Indicador para que app.js lo maneje
                }
                if (pathParts[0].startsWith('@') && pathParts[0].length > 1) {
                     // Para URLs con /@NombreUsuario, también se requiere resolución.
                    console.warn('URLs de YouTube con /@ requieren resolución adicional para obtener Channel ID.');
                    return `handle:${pathParts[0].substring(1)}`; // Indicador
                }
            }
        }
    } catch (error) {
        console.warn('No se pudo parsear la URL de YouTube:', urlOrId, error);
    }
    // Si no es una URL reconocida o es un formato que no manejamos directamente para ID
    console.log(`Input de YouTube "${urlOrId}" no es un ID de canal directo. Podría ser un nombre de usuario o URL personalizada.`);
    return urlOrId; // Devolver el input original si no se pudo extraer un ID claro
}


/**
 * Verifica el estado de un stream de YouTube.
 * @param {string} originalInput - La URL o identificador original proporcionado por el usuario.
 * @returns {Promise<object>} Un objeto con la información del stream.
 * Ej: { platform: 'youtube', identifier: 'ID_Canal_o_Input', name: 'Nombre Canal', status: 'Live'/'Offline'/'Error', lastCheck: 'HH:MM:SS', title: 'Título Stream (opcional)' }
 */
async function getYouTubeStreamStatus(originalInput) {
    const channelIdOrHandle = getYouTubeChannelId(originalInput); // Intenta obtener un ID o manejador

    if (!channelIdOrHandle) {
        return { platform: 'youtube', identifier: originalInput, name: originalInput, status: 'Error', details: 'Input inválido', lastCheck: new Date().toLocaleTimeString() };
    }
    
    let effectiveChannelId = channelIdOrHandle;
    let searchType = 'channelId';

    // Lógica conceptual para resolver handles o URLs personalizadas (necesitaría otra llamada a la API)
    // Por ahora, si no es un ID directo (UC...), la API de search.list podría no funcionar como se espera
    // directamente con un handle o custom URL en el parámetro `channelId`.
    // La API `channels.list` con `forUsername` (obsoleto) o buscando por el handle
    // sería necesaria para obtener el channelId real.
    // Simplificaremos y asumiremos que si no es `UC...`, es un nombre/input que intentaremos usar.

    if (channelIdOrHandle.startsWith('custom_url:') || channelIdOrHandle.startsWith('handle:')) {
        // Aquí iría la lógica para convertir custom_url o handle a un channelId real.
        // Esta es una parte COMPLEJA que requiere una llamada API adicional a 'channels.list' con 'forHandle' (si existe) o 'search.list' para encontrar el canal.
        // Por ahora, marcaremos como error o "necesita resolución".
        console.warn(`Resolución de ${channelIdOrHandle} a Channel ID no implementada en este ejemplo conceptual.`);
        // Devolveremos 'Error' o un estado que indique que se necesita más trabajo.
        // O podrías intentar una búsqueda general si la API lo permite con el nombre.
        effectiveChannelId = channelIdOrHandle.split(':')[1]; // Usar el nombre para una búsqueda (menos preciso)
        searchType = 'q'; // Cambiar a búsqueda por query con el nombre del canal/handle
    }


    const streamInfo = {
        platform: 'youtube',
        identifier: effectiveChannelId, // El ID o handle que se usará para la API
        name: originalInput, // Usar el input original como nombre por defecto hasta obtener uno mejor
        status: 'Offline',
        lastCheck: new Date().toLocaleTimeString(),
        title: null,
        viewers: null // YouTube API v3 search.list no provee conteo de viewers directamente para 'live'
    };

    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'TAIzaSyDbK-imV7m7JGs3bWlij7ovM4FpyN9Zpxg') {
        console.error('API Key de YouTube no configurada en api_youtube.js');
        streamInfo.status = 'Error';
        streamInfo.details = 'API Key no configurada.';
        return streamInfo;
    }

    // Endpoint para buscar videos en vivo de un canal específico
    let apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&eventType=live&type=video&key=${YOUTUBE_API_KEY}`;
    if (searchType === 'channelId' && effectiveChannelId.startsWith('UC')) {
        apiUrl += `&channelId=${effectiveChannelId}`;
    } else if (searchType === 'q') { // Búsqueda por query (nombre del canal/handle)
        apiUrl += `&q=${encodeURIComponent(effectiveChannelId)}&maxResults=5`; // Buscar y luego filtrar por el nombre exacto del canal
    } else {
        streamInfo.status = 'Error';
        streamInfo.details = 'Identificador de canal de YouTube no válido para búsqueda directa.';
        return streamInfo;
    }


    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error API YouTube:', response.status, errorData);
            streamInfo.status = 'Error';
            streamInfo.details = `API Error: ${errorData.error?.message || response.statusText}`;
            return streamInfo;
        }

        const data = await response.json();

        if (data.items && data.items.length > 0) {
            // Si es una búsqueda 'q', necesitamos asegurarnos de que el resultado coincida con el canal esperado
            let liveStreamItem = null;
            if (searchType === 'q') {
                // Aquí necesitarías una lógica más robusta para emparejar `data.items[i].snippet.channelTitle`
                // con el `effectiveChannelId` (nombre del canal/handle), ya que 'q' puede devolver múltiples resultados.
                // Por simplicidad, tomamos el primero, pero esto es impreciso.
                liveStreamItem = data.items.find(item => item.snippet.channelTitle.toLowerCase().includes(effectiveChannelId.toLowerCase()));
            } else { // channelId
                 liveStreamItem = data.items[0]; // Asumimos que el primer resultado es el correcto si buscamos por channelId
            }

            if (liveStreamItem) {
                streamInfo.status = 'Live';
                streamInfo.name = liveStreamItem.snippet.channelTitle; // Actualizar con el nombre oficial
                streamInfo.title = liveStreamItem.snippet.title;
                // Nota: El endpoint search.list no provee directamente el conteo de viewers de un stream en vivo.
                // Para eso, necesitarías obtener el videoId (data.items[0].id.videoId) y luego hacer otra
                // llamada al endpoint videos.list con part=liveStreamingDetails.
            } else {
                 streamInfo.status = 'Offline';
                 if (searchType === 'q') streamInfo.details = 'Canal encontrado pero no parece estar en vivo, o no es el resultado esperado.';
            }
        } else {
            streamInfo.status = 'Offline';
        }
    } catch (error) {
        console.error('Error al contactar API de YouTube:', error);
        streamInfo.status = 'Error';
        streamInfo.details = 'Fallo de conexión o parsing.';
    }

    return streamInfo;
}