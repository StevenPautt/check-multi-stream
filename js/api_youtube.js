// js/api_youtube.js

/**
 * Contiene la lógica para interactuar con la API de YouTube
 * y verificar el estado de los streams.
 */


const YOUTUBE_API_KEY = 'AIzaSyDbK-imV7m7JGs3bWlij7ovM4FpyN9Zpxg';

/**
 * Extrae el identificador relevante (Channel ID, Custom URL Name, Handle, o Video ID) de una URL de YouTube.
 * @param {string} urlInput - La URL completa de YouTube o un identificador directo.
 * @returns {{type: string, value: string, originalInput: string}|null} Objeto con tipo y valor, o null.
 * Tipos: 'channelId', 'customUrlName', 'handleName', 'videoId', 'unknownInput'.
 */
function parseYouTubeUrl(urlInput) {
    const original = urlInput; // Guardar el input original
    if (!urlInput || typeof urlInput !== 'string') return { type: 'unknownInput', value: original, originalInput: original };

    // 1. Comprobar si es un Channel ID directo (UC...)
    if (urlInput.startsWith('UC') && urlInput.length === 24) {
        return { type: 'channelId', value: urlInput, originalInput: original };
    }

    // 2. Comprobar si es un Video ID directo (11 caracteres alfanuméricos, -, _)
    // Esta es una heurística, podría haber falsos positivos si se pasa un nombre corto.
    if (urlInput.match(/^[a-zA-Z0-9_-]{11}$/)) {
        return { type: 'videoId', value: urlInput, originalInput: original };
    }

    try {
        const normalizedUrl = urlInput.toLowerCase().startsWith('http') ? urlInput : `https://` + urlInput;
        const url = new URL(normalizedUrl);

        if (url.hostname.includes('youtube.com/c/ChannelName7') || url.hostname.includes('youtu.be/')) {
            const pathname = url.pathname;
            const searchParams = url.searchParams;

            // Video ID de /watch?v=VIDEO_ID
            if (pathname.startsWith('/watch') && searchParams.has('v')) {
                return { type: 'videoId', value: searchParams.get('v'), originalInput: original };
            }
            // Video ID de /live/VIDEO_ID
            const liveMatch = pathname.match(/^\/live\/([a-zA-Z0-9_-]+)/);
            if (liveMatch && liveMatch[1]) {
                return { type: 'videoId', value: liveMatch[1], originalInput: original };
            }
            // Video ID de youtu.be/ (ej. youtu.be/VIDEO_ID)
            if (url.hostname.includes('youtu.be/') && pathname.length > 1 && !pathname.substring(1).includes('/')) {
                return { type: 'videoId', value: pathname.substring(1), originalInput: original };
            }

            // Channel ID (/channel/CHANNEL_ID)
            const channelMatch = pathname.match(/^\/channel\/([a-zA-Z0-9_-]{24})/); // UC...
            if (channelMatch && channelMatch[1]) {
                return { type: 'channelId', value: channelMatch[1], originalInput: original };
            }

            // Custom URL Name (/c/CUSTOM_NAME)
            const customUrlMatch = pathname.match(/^\/(c|user)\/([a-zA-Z0-9_-]+)/); // También /user/ antiguo
            if (customUrlMatch && customUrlMatch[2]) {
                return { type: 'customUrlName', value: customUrlMatch[2], originalInput: original };
            }

            // Handle (/@HANDLE)
            const handleMatch = pathname.match(/^\/(@[a-zA-Z0-9_.-]+)/);
            if (handleMatch && handleMatch[1]) {
                return { type: 'handleName', value: handleMatch[1].substring(1), originalInput: original }; // Quitar el @
            }
            
            // Handle sin @ como primer path segment (ej. youtube.com/c/ChannelName8)
             const pathParts = pathname.split('/').filter(part => part.length > 0);
             if (pathParts.length === 1 && !searchParams.toString() && !pathParts[0].startsWith('UC')) {
                 // Si no es un Channel ID (UC...) y es un solo segmento, podría ser un handle/customURL/legacy username
                 return { type: 'handleName', value: pathParts[0], originalInput: original }; // Tratarlo como handleName para resolución
             }
        }
    } catch (error) {
        console.warn(`api_youtube.js: No se pudo parsear como URL de YouTube: "${urlInput}". Se tratará como identificador directo.`, error.message);
        // Si falla el parseo de URL, podría ser un nombre o handle pasado directamente.
        return { type: 'directNameOrHandle', value: urlInput, originalInput: original };
    }
    // Si nada coincide, devolver el input original para un último intento de búsqueda o error.
    return { type: 'unknownInput', value: urlInput, originalInput: original };
}


/**
 * Verifica el estado de un stream de YouTube.
 * @param {string} originalUrlOrIdentifier - La URL o identificador original proporcionado por el usuario.
 * @returns {Promise<object>} Un objeto con la información del stream.
 */
async function getYouTubeStreamStatus(originalUrlOrIdentifier) {
    console.log(`api_youtube.js: Iniciando verificación para input: ${originalUrlOrIdentifier}`);

    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'TU_YOUTUBE_API_KEY_AQUI') {
        console.error('api_youtube.js: API Key de YouTube no configurada.');
        return { platform: 'youtube', identifier: originalUrlOrIdentifier, name: originalUrlOrIdentifier, status: 'Error Config.', details: 'API Key no configurada.', lastCheck: new Date().toLocaleTimeString() };
    }

    const parsed = parseYouTubeUrl(originalUrlOrIdentifier);
    console.log(`api_youtube.js: Resultado del parseo de URL:`, parsed);

    const streamInfo = {
        platform: 'youtube',
        identifier: parsed.value,        // El ID/nombre/handle extraído, podría ser refinado
        name: parsed.originalInput,    // Por defecto el input original, se intentará mejorar
        status: 'Offline',
        lastCheck: new Date().toLocaleTimeString(),
        title: null,
        details: null,
        viewers: null
    };

    let channelIdToQuery = null;
    let videoIdToQuery = null;

    if (parsed.type === 'channelId') {
        channelIdToQuery = parsed.value;
    } else if (parsed.type === 'videoId') {
        videoIdToQuery = parsed.value;
    } else if (['customUrlName', 'handleName', 'legacyOrHandle', 'directNameOrHandle', 'unknownInput'].includes(parsed.type) && parsed.value) {
        // --- PASO 1: Intentar resolver el nombre/handle/URLcustom a un Channel ID ---
        console.log(`api_youtube.js: Intentando resolver '${parsed.value}' (${parsed.type}) a Channel ID...`);
        const resolveUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(parsed.value)}&type=channel&maxResults=1&key=${YOUTUBE_API_KEY}`;
        console.log("api_youtube.js: URL de resolución:", resolveUrl);
        try {
            const resolveResponse = await fetch(resolveUrl);
            const resolveData = await resolveResponse.json();
            console.log("api_youtube.js: Respuesta de resolución:", resolveData);

            if (!resolveResponse.ok) {
                streamInfo.status = 'Error API';
                streamInfo.details = `Resolución fallida (${resolveResponse.status}): ${resolveData.error?.message || resolveResponse.statusText}`;
                return streamInfo;
            }

            if (resolveData.items && resolveData.items.length > 0 && resolveData.items[0].id.kind === 'youtube#channel') {
                channelIdToQuery = resolveData.items[0].id.channelId;
                streamInfo.name = resolveData.items[0].snippet.title; // Actualizar con el título del canal oficial
                streamInfo.identifier = channelIdToQuery; // Usar el Channel ID resuelto como identificador principal
                console.log(`api_youtube.js: Resuelto a Channel ID: ${channelIdToQuery} (${streamInfo.name})`);
            } else {
                console.warn(`api_youtube.js: No se pudo resolver '${parsed.value}' a un Channel ID mediante búsqueda.`);
                streamInfo.status = 'Error';
                streamInfo.details = 'Canal no encontrado por nombre/handle.';
                return streamInfo;
            }
        } catch (resolveError) {
            console.error('api_youtube.js: Error durante la resolución del Channel ID:', resolveError);
            streamInfo.status = 'Error';
            streamInfo.details = 'Fallo de conexión al resolver Channel ID.';
            return streamInfo;
        }
    } else { // unknownInput o un tipo no manejado explícitamente para resolución
        streamInfo.status = 'Error';
        streamInfo.details = `Formato de input de YouTube no reconocido o inválido: ${parsed.type}`;
        return streamInfo;
    }

    // --- PASO 2: Verificar estado del stream usando channelIdToQuery o videoIdToQuery ---
    try {
        let statusApiUrl;
        if (videoIdToQuery) {
            console.log(`api_youtube.js: Verificando Video ID: ${videoIdToQuery}`);
            statusApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${videoIdToQuery}&key=${YOUTUBE_API_KEY}`;
        } else if (channelIdToQuery) {
            console.log(`api_youtube.js: Buscando streams en vivo para Channel ID: ${channelIdToQuery}`);
            statusApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelIdToQuery}&eventType=live&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`;
        } else {
            // Esto no debería ocurrir si la lógica de resolución funcionó o el input era un ID directo
            streamInfo.status = 'Error';
            streamInfo.details = 'No hay un Channel ID o Video ID válido para consultar.';
            return streamInfo;
        }

        console.log("api_youtube.js: URL de estado:", statusApiUrl);
        const statusResponse = await fetch(statusApiUrl);
        const statusData = await statusResponse.json();
        console.log("api_youtube.js: Respuesta de estado:", statusData);

        if (!statusResponse.ok) {
            streamInfo.status = 'Error API';
            streamInfo.details = `Verificación de estado fallida (${statusResponse.status}): ${statusData.error?.message || statusResponse.statusText}`;
            return streamInfo;
        }

        if (statusData.items && statusData.items.length > 0) {
            const item = statusData.items[0];
            if (videoIdToQuery) { // Respuesta de videos.list
                if (item.snippet && item.liveStreamingDetails && item.liveStreamingDetails.actualStartTime && !item.liveStreamingDetails.actualEndTime) {
                    streamInfo.status = 'Live';
                    streamInfo.title = item.snippet.title;
                    streamInfo.name = item.snippet.channelTitle; // Actualizar nombre del canal
                    // streamInfo.viewers = item.liveStreamingDetails.concurrentViewers; // Necesita 'statistics' part
                } else {
                    streamInfo.status = 'Offline';
                    streamInfo.details = 'Video no está en vivo o ya terminó.';
                }
            } else { // Respuesta de search.list (para channelIdToQuery)
                streamInfo.status = 'Live';
                streamInfo.title = item.snippet.title;
                // streamInfo.name ya fue establecido durante la resolución del Channel ID
                // El conteo de viewers no está disponible directamente en search.list para streams en vivo.
            }
        } else {
            streamInfo.status = 'Offline';
            if (channelIdToQuery) streamInfo.details = 'Canal no está transmitiendo en vivo o no se encontraron streams.';
            if (videoIdToQuery) streamInfo.details = 'Video no encontrado o no accesible.';
        }
    } catch (error) {
        console.error('api_youtube.js: Error al verificar estado del stream:', error);
        streamInfo.status = 'Error';
        streamInfo.details = 'Fallo de conexión o parsing al verificar estado.';
    }
    streamInfo.lastCheck = new Date().toLocaleTimeString();
    return streamInfo;
}