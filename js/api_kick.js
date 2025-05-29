// js/api_kick.js

/**
 * Contiene la lógica para interactuar con la API (no oficial/pública) de Kick
 * y verificar el estado de los streams.
 * Endpoint común: https://kick.com/api/v2/channels/{username}
 *
 * NOTA: Esta API es pública y podría cambiar sin previo aviso.
 */

/**
 * Extrae el nombre de usuario de Kick desde una URL o devuelve el input si ya es un nombre de usuario.
 * @param {string} inputOrUrl - La URL del canal de Kick o el nombre de usuario.
 * @returns {string|null} El nombre de usuario de Kick o null.
 */
function getKickUsername(inputOrUrl) {
    if (!inputOrUrl || typeof inputOrUrl !== 'string') return null;

    let username = inputOrUrl;
    if (inputOrUrl.toLowerCase().includes('kick.com/')) {
        try {
            // Intentar extraer de URL como kick.com/username o kick.com/video/id (aunque el endpoint es por canal)
            const url = new URL(inputOrUrl.startsWith('http') ? inputOrUrl : `https://${inputOrUrl}`);
            const pathParts = url.pathname.split('/').filter(part => part.length > 0);
            if (pathParts.length > 0) {
                // Si es kick.com/username, pathParts[0] es el username
                // Si es kick.com/video/VIDEO_ID, esto no nos da el username directamente.
                // Asumimos por ahora que la URL es directa al canal.
                username = pathParts[0];
            }
        } catch (error) {
            console.warn(`api_kick.js: No se pudo parsear como URL de Kick: "${inputOrUrl}". Se usará como username directo.`, error.message);
        }
    }
    // Quitar cualquier query string si el input fue solo "username?param=val"
    username = username.split('?')[0];
    console.log(`api_kick.js: Username de Kick extraído/usado: ${username} para input: ${inputOrUrl}`);
    return username;
}

/**
 * Verifica el estado de un stream de Kick.
 * @param {string} originalInput - La URL o nombre de usuario de Kick.
 * @returns {Promise<object>} Un objeto con la información del stream.
 */
async function getKickStreamStatus(originalInput) {
    console.log(`api_kick.js: Iniciando verificación para Kick input: ${originalInput}`);

    const username = getKickUsername(originalInput);

    const streamInfo = {
        platform: 'kick',
        identifier: username,       // El username extraído
        name: originalInput,      // Por defecto el input original, se intentará mejorar
        originalInput: originalInput, // Para el ID de fila en ui.js
        status: 'Offline',
        lastCheck: new Date().toLocaleTimeString(),
        title: null,
        details: null,
        viewers: null
    };

    if (!username) {
        streamInfo.status = 'Error';
        streamInfo.details = 'Input de Kick inválido o no extraíble.';
        return streamInfo;
    }

    // API Endpoint público (v2 es más reciente, v1 también existe)
    const apiUrl = `https://kick.com/api/v2/channels/${username.toLowerCase()}`; // Kick parece ser sensible a mayúsculas/minúsculas en API para username
    console.log("api_kick.js: Llamando a URL de API Kick:", apiUrl);

    try {
        const response = await fetch(apiUrl);
        // Kick devuelve 404 si el canal no existe, o a veces incluso si existe pero no está en vivo de una manera específica.
        // Un canal que existe pero está offline usualmente devuelve 200 OK con datos del canal.

        if (!response.ok) {
            if (response.status === 404) {
                streamInfo.status = 'Offline'; // O 'No Existe'
                streamInfo.details = 'Canal no encontrado en Kick o no existe.';
            } else {
                streamInfo.status = 'Error API';
                streamInfo.details = `Kick API Error: ${response.status} ${response.statusText}`;
            }
            const errorData = await response.text(); // Intentar leer como texto si no es JSON
            console.error(`api_kick.js: ${streamInfo.details}`, errorData);
            return streamInfo;
        }

        const data = await response.json();
        console.log("api_kick.js: Datos recibidos de API Kick:", data);

        if (data && data.user && data.user.username) {
            streamInfo.name = data.user.username; // Nombre oficial con mayúsculas/minúsculas
            streamInfo.identifier = data.user.username; // Usar el username oficial como identifier
        }

        // La estructura para saber si está en vivo es data.livestream
        // Si data.livestream es null, está offline. Si tiene un objeto, está en vivo.
        if (data && data.livestream) { // Asumiendo que `livestream` no es null cuando está en vivo
            streamInfo.status = 'Live';
            streamInfo.title = data.livestream.session_title || 'Stream en vivo';
            streamInfo.viewers = data.livestream.viewer_count;
            // Podrías añadir más info si está disponible, como data.livestream.categories
        } else {
            streamInfo.status = 'Offline';
        }

    } catch (error) {
        console.error('api_kick.js: Error al contactar API de Kick o parsear JSON:', error);
        streamInfo.status = 'Error';
        streamInfo.details = 'Fallo de conexión o parsing con API de Kick.';
    }
    streamInfo.lastCheck = new Date().toLocaleTimeString();
    return streamInfo;
}