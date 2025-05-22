/**
 * api_facebook.js
 * Contiene la lógica conceptual para interactuar con la Graph API de Facebook
 * y verificar el estado de los streams en vivo de Páginas.
 *
 * IMPORTANTE: Este código es conceptual. Necesitarás un Access Token válido,
 * gestionar permisos, y posiblemente pasar por revisión de App de Facebook.
 * La API de Facebook es más restrictiva.
 */

// DEBERÍAS OBTENER ESTE TOKEN MEDIANTE UN FLUJO OAUTH SEGURO Y GESTIONARLO ADECUADAMENTE.
// NO LO INCRUSTES DIRECTAMENTE EN CÓDIGO DE PRODUCCIÓN SI ES UN TOKEN DE USUARIO O DE LARGA DURACIÓN.
// Un App Token podría funcionar para algunos datos públicos de páginas, pero es limitado.
const FACEBOOK_ACCESS_TOKEN = 'EAAJyodUbwLQBO6DG2SOv2I3ZBovzWTWGqKAJOOn1I6dRn0J5VjdgZAC2ksAydrC9d1sMm0xweGQ6OY2W84T3a5nHdbjyT0ZBbiqtjlyHorC8BgYqLI6SlVwcB7mV9FHvVf8vo4ZCfLF3bBzpFedhujYv0m3sWm4DLLtP5tPgUhUIAmmbrCEYbTkZAYZBz2rfTiXtNZB82aB5zuSRjgVbxza5HgWZA56REAS3';
const FACEBOOK_API_VERSION = 'v19.0'; // Usa la versión más reciente que te funcione

/**
 * Extrae el ID o nombre de una Página de Facebook desde una URL.
 * Simplificado, puede necesitar mejoras.
 * @param {string} urlOrId - La URL de la página o su ID/nombre.
 * @returns {string|null} El ID/nombre de la página o null.
 */
function getFacebookPageIdentifier(urlOrId) {
    if (!urlOrId) return null;

    try {
        // Si parece una URL de Facebook
        if (urlOrId.includes('facebook.com')) {
            const url = new URL(urlOrId);
            const pathParts = url.pathname.split('/').filter(part => part.length > 0 && part.toLowerCase() !== 'videos' && part.toLowerCase() !== 'live');
            
            // facebook.com/PageName
            // facebook.com/PageName/
            // facebook.com/groups/GroupName (no soportado aquí)
            // facebook.com/profile.php?id=12345 (para perfiles, no páginas)
            if (pathParts.length > 0 && !url.searchParams.get('id')) {
                // Ignorar 'pg' si está presente, ej. facebook.com/pg/PageName/videos/
                let potentialId = pathParts[0] === 'pg' && pathParts.length > 1 ? pathParts[1] : pathParts[0];
                // Podría haber más segmentos como /posts/, /videos/. Nos quedamos con el primero como posible ID/nombre.
                return potentialId;
            }
            // Para URLs como facebook.com/profile.php?id=NUMERIC_ID (generalmente perfiles, no páginas)
            // o facebook.com/pages/?id=NUMERIC_ID
            const idParam = url.searchParams.get('id');
            if (idParam) {
                return idParam;
            }
        }
    } catch (error) {
        console.warn('No se pudo parsear la URL de Facebook:', urlOrId, error);
    }
    // Si no es una URL o no se pudo parsear, asumir que es un ID/nombre directamente
    return urlOrId;
}


/**
 * Verifica el estado de un stream en vivo de una Página de Facebook.
 * @param {string} originalInput - La URL o identificador de la página.
 * @returns {Promise<object>} Un objeto con la información del stream.
 */
async function getFacebookStreamStatus(originalInput) {
    const pageIdentifier = getFacebookPageIdentifier(originalInput);

    if (!pageIdentifier) {
        return { platform: 'facebook', identifier: originalInput, name: originalInput, status: 'Error', details: 'Input inválido', lastCheck: new Date().toLocaleTimeString() };
    }

    const streamInfo = {
        platform: 'facebook',
        identifier: pageIdentifier,
        name: originalInput, // Usar input original hasta obtener nombre de la página
        status: 'Offline',
        lastCheck: new Date().toLocaleTimeString(),
        title: null,
        viewers: null // La API de live_videos no siempre da viewers fácilmente
    };

    if (!FACEBOOK_ACCESS_TOKEN || FACEBOOK_ACCESS_TOKEN === 'TU_FACEBOOK_ACCESS_TOKEN_AQUI') {
        console.error('Access Token de Facebook no configurado en api_facebook.js');
        streamInfo.status = 'Error';
        streamInfo.details = 'Access Token no configurado.';
        return streamInfo;
    }

    // Endpoint para obtener videos en vivo de una página
    // Necesitas el ID numérico de la página o su "username" (vanity name).
    // También puedes obtener el nombre de la página con ?fields=name
    const pageInfoUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageIdentifier}?fields=name&access_token=${FACEBOOK_ACCESS_TOKEN}`;
    const liveVideosUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageIdentifier}/live_videos?fields=status,title,creation_time,live_views&access_token=${FACEBOOK_ACCESS_TOKEN}`;

    try {
        // 1. Obtener nombre de la página (opcional pero bueno para la UI)
        try {
            const pageResponse = await fetch(pageInfoUrl);
            if (pageResponse.ok) {
                const pageData = await pageResponse.json();
                if (pageData.name) {
                    streamInfo.name = pageData.name;
                }
            } else {
                 console.warn(`No se pudo obtener nombre para la página de Facebook: ${pageIdentifier}`);
            }
        } catch(nameError) {
            console.warn(`Error obteniendo nombre de página de Facebook ${pageIdentifier}:`, nameError);
        }


        // 2. Verificar videos en vivo
        const response = await fetch(liveVideosUrl);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error API Facebook:', response.status, errorData);
            streamInfo.status = 'Error';
            streamInfo.details = `API Error: ${errorData.error?.message || response.statusText}`;
            return streamInfo;
        }

        const data = await response.json();

        if (data.data && data.data.length > 0) {
            // La API devuelve una lista de videos. Debemos encontrar el que está realmente 'LIVE'.
            // Un video puede tener status 'LIVE_STOPPED', 'VOD', etc.
            const liveStream = data.data.find(video => video.status === 'LIVE');

            if (liveStream) {
                streamInfo.status = 'Live';
                streamInfo.title = liveStream.title || 'Stream en vivo';
                // streamInfo.viewers = liveStream.live_views; // 'live_views' puede no estar siempre disponible o ser preciso.
            } else {
                streamInfo.status = 'Offline';
            }
        } else {
            streamInfo.status = 'Offline';
        }
    } catch (error) {
        console.error('Error al contactar API de Facebook:', error);
        streamInfo.status = 'Error';
        streamInfo.details = 'Fallo de conexión o parsing.';
    }

    return streamInfo;
}