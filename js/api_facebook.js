// js/api_facebook.js

/**
 * Contiene la lógica para interactuar con la Graph API de Facebook
 * y verificar el estado de los streams en vivo de Páginas.
 *
 * IMPORTANTE: Necesitarás un Access Token válido (preferiblemente un Page Access Token
 * para una página que administres, o un User Access Token con permisos
 * como pages_read_engagement).
 */

// --- ¡¡¡REEMPLAZA ESTO CON TU ACCESS TOKEN!!! ---
const FACEBOOK_ACCESS_TOKEN = 'EAAJyodUbwLQBOw8RcGC71zAx58J7OyH5PDfn2x4iR8EO760sp0TehlRYavmUrLWNHS2QG2rDasn94wSbSfsqWUFeqiFwUXB4ZC3GB7ZCZB5dc9AN0dhI6039PZAJNhRcsxGh44qchCwLSOxAkTQ0CCFXOr9Ky9r7zrLQPsx5NrlvjZC1PZAeLppAFUuT3cVtnIKKmEszd2ZBAvteeycehV97T4kDZA40YmMCca2oZAwxtcZBvl9UvDGBkZD';
const FACEBOOK_API_VERSION = 'v19.0'; // Usa la versión más reciente estable

/**
 * Extrae el identificador de una Página de Facebook (ID numérico o nombre personalizado) desde una URL.
 * Esta es una función simplificada y podría necesitar mejoras para cubrir todos los formatos de URL.
 * @param {string} urlOrIdentifier - La URL de la página o su ID/nombre.
 * @returns {string|null} El ID/nombre de la página o null si no se puede extraer.
 */
function getFacebookPageIdentifier(urlOrIdentifier) {
    if (!urlOrIdentifier || typeof urlOrIdentifier !== 'string') return null;

    let identifier = urlOrIdentifier;
    try {
        if (urlOrIdentifier.toLowerCase().startsWith('http')) {
            const url = new URL(urlOrIdentifier);
            if (url.hostname.includes('facebook.com')) {
                const pathParts = url.pathname.split('/').filter(part => 
                    part.length > 0 && 
                    !['videos', 'live', 'events', 'photos', 'reels', 'notes', 'groups', 'pg'].includes(part.toLowerCase())
                );
                
                // Intenta obtener el primer segmento significativo del path
                if (pathParts.length > 0) {
                    identifier = pathParts[0];
                } else if (url.searchParams.get('id')) { // Para URLs como facebook.com/profile.php?id=PAGE_ID (aunque esto es más para perfiles)
                    identifier = url.searchParams.get('id');
                } else if (url.searchParams.get('page_id')) { // Algunas URLs podrían usar page_id
                    identifier = url.searchParams.get('page_id');
                }
                 // Si después de esto, identifier sigue siendo una URL completa, es un error de parseo
                if (identifier.toLowerCase().startsWith('http')) {
                    console.warn(`api_facebook.js: No se pudo extraer un identificador de página claro de: ${urlOrIdentifier}. Se usará la URL completa.`);
                    identifier = urlOrIdentifier; // fallback, aunque probablemente falle en la API
                }
            }
        }
    } catch (error) {
        console.warn(`api_facebook.js: Error parseando URL de Facebook "${urlOrIdentifier}". Se usará como identificador directo.`, error.message);
        // Si no es una URL válida, se asume que urlOrIdentifier es ya un ID o nombre de página.
    }
    console.log(`api_facebook.js: Identificador de página de Facebook extraído/usado: ${identifier} para input: ${urlOrIdentifier}`);
    return identifier;
}


/**
 * Verifica el estado de un stream en vivo de una Página de Facebook.
 * @param {string} originalInput - La URL o identificador de la página proporcionado por el usuario.
 * @returns {Promise<object>} Un objeto con la información del stream.
 */
async function getFacebookStreamStatus(originalInput) {
    console.log(`api_facebook.js: Iniciando verificación para input de Facebook: ${originalInput}`);

    if (!FACEBOOK_ACCESS_TOKEN || FACEBOOK_ACCESS_TOKEN === 'TU_FACEBOOK_ACCESS_TOKEN_AQUI') {
        console.error('api_facebook.js: Access Token de Facebook no configurado.');
        return { platform: 'facebook', identifier: originalInput, name: originalInput, status: 'Error Config.', details: 'Access Token no configurado.', lastCheck: new Date().toLocaleTimeString() };
    }

    const pageIdentifier = getFacebookPageIdentifier(originalInput);

    const streamInfo = {
        platform: 'facebook',
        identifier: pageIdentifier, // El ID/nombre de página que se usará para la API
        name: originalInput,        // Por defecto el input original, se intentará mejorar
        status: 'Offline',
        lastCheck: new Date().toLocaleTimeString(),
        title: null,
        details: null,
        viewers: null
    };

    if (!pageIdentifier) {
        streamInfo.status = 'Error';
        streamInfo.details = 'Identificador de página de Facebook inválido o no extraíble.';
        return streamInfo;
    }

    try {
        // 1. (Opcional pero recomendado) Obtener el nombre oficial de la página
        const pageDetailsUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageIdentifier}?fields=name,username&access_token=${FACEBOOK_ACCESS_TOKEN}`;
        console.log("api_facebook.js: URL para detalles de página:", pageDetailsUrl);
        try {
            const pageDetailsResponse = await fetch(pageDetailsUrl);
            if (pageDetailsResponse.ok) {
                const pageDetailsData = await pageDetailsResponse.json();
                if (pageDetailsData.name) {
                    streamInfo.name = pageDetailsData.name; // Actualizar con el nombre oficial
                }
                // Si el pageIdentifier original no era el numérico, el pageDetailsData.id sí lo será
                // y podría ser mejor usar ese para la llamada a live_videos.
                if (pageDetailsData.id && pageDetailsData.id !== pageIdentifier) {
                     console.log(`api_facebook.js: ID numérico de página resuelto: ${pageDetailsData.id} para ${pageIdentifier}`);
                     // streamInfo.identifier = pageDetailsData.id; // Opcional: actualizar al ID numérico si es diferente
                }
            } else {
                console.warn(`api_facebook.js: No se pudo obtener detalles para la página de Facebook: ${pageIdentifier}. Estado: ${pageDetailsResponse.status}`);
            }
        } catch (pageDetailsError) {
            console.warn(`api_facebook.js: Error obteniendo detalles de página ${pageIdentifier}:`, pageDetailsError.message);
        }


        // 2. Verificar videos en vivo
        // Campos útiles: status, title, description, embed_html, live_views (puede requerir más permisos/revisión)
        const liveVideosUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${streamInfo.identifier}/live_videos?fields=status,title,description,live_views&access_token=${FACEBOOK_ACCESS_TOKEN}`;
        console.log("api_facebook.js: URL para videos en vivo:", liveVideosUrl);
        
        const response = await fetch(liveVideosUrl);
        const data = await response.json(); // Intentar parsear JSON incluso si no es ok, para ver el error
        console.log("api_facebook.js: Respuesta de API de videos en vivo:", data);

        if (!response.ok) {
            streamInfo.status = 'Error API';
            streamInfo.details = `API Error (${response.status}): ${data.error?.message || response.statusText}`;
            return streamInfo;
        }

        if (data.data && data.data.length > 0) {
            // La API devuelve una lista de videos. Buscar el que esté realmente 'LIVE'.
            // Un video puede tener status 'LIVE_STOPPED', 'VOD', etc.
            const liveStream = data.data.find(video => video.status === 'LIVE');

            if (liveStream) {
                streamInfo.status = 'Live';
                streamInfo.title = liveStream.title || 'Stream en vivo';
                streamInfo.details = liveStream.description || null;
                // streamInfo.viewers = liveStream.live_views; // live_views puede no estar siempre o requerir permisos/insights
            } else {
                streamInfo.status = 'Offline';
                streamInfo.details = 'No se encontraron streams activos en este momento.';
            }
        } else {
            streamInfo.status = 'Offline';
            streamInfo.details = 'No hay videos en vivo listados para esta página.';
        }
    } catch (error) {
        console.error('api_facebook.js: Error al contactar API de Facebook:', error);
        streamInfo.status = 'Error';
        streamInfo.details = 'Fallo de conexión o parsing con API de Facebook.';
    }
    streamInfo.lastCheck = new Date().toLocaleTimeString();
    return streamInfo;
}