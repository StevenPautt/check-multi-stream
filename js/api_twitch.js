// js/api_twitch.js

/**
 * Contiene la lógica para interactuar con la API Helix de Twitch
 * y verificar el estado de los streams.
 *
 * IMPORTANTE: Necesitarás un Client ID de Twitch y un App Access Token.
 * El App Access Token se obtiene idealmente desde un backend.
 * Para pruebas, puedes generarlo manualmente y pegarlo, pero ¡NUNCA LO SUBAS A UN REPOSITORIO PÚBLICO!
 */

// --- ¡¡¡REEMPLAZA ESTOS VALORES CON TUS CREDENCIALES DE TWITCH!!! ---
const TWITCH_CLIENT_ID = '4m2u1209v5ktf2gf87iettde46ibmt';
// Este token deberías obtenerlo de forma segura. Para pruebas, puedes generar uno y pegarlo.
// ¡NO COMITAS ESTE TOKEN A GITHUB SI ES REAL Y DE LARGA DURACIÓN!
const TWITCH_APP_ACCESS_TOKEN = 'iu2f1i0rzcnx292t404on7b4e70edn'; 

/**
 * Extrae el nombre de usuario de Twitch desde una URL o devuelve el input si ya es un nombre de usuario.
 * @param {string} inputOrUrl - La URL del canal de Twitch o el nombre de usuario.
 * @returns {string|null} El nombre de usuario de Twitch o null.
 */
function getTwitchUsername(inputOrUrl) {
    if (!inputOrUrl || typeof inputOrUrl !== 'string') return null;

    let username = inputOrUrl;
    const lowerInput = inputOrUrl.toLowerCase();

    if (lowerInput.includes('twitch.tv/')) {
        try {
            // Quitar protocolo si existe para simplificar
            let pathPart = lowerInput.startsWith('http') ? new URL(lowerInput).pathname : lowerInput;
            // Quitar 'twitch.tv/' si está al inicio del path (o de la cadena si no es URL completa)
            if (pathPart.startsWith('twitch.tv/')) {
                pathPart = pathPart.substring('twitch.tv/'.length);
            } else if (pathPart.startsWith('/')) { // Si es solo el path /username
                 pathPart = pathPart.substring(1);
            }
            
            const pathSegments = pathPart.split('/').filter(part => part.length > 0);
            if (pathSegments.length > 0) {
                username = pathSegments[0]; // El primer segmento después de twitch.tv/ es el username
            }
        } catch (error) {
            console.warn(`api_twitch.js: No se pudo parsear como URL de Twitch: "${inputOrUrl}". Se usará como username directo.`, error.message);
        }
    }
    // Quitar cualquier query string
    username = username.split('?')[0];
    console.log(`api_twitch.js: Username de Twitch extraído/usado: ${username} para input: ${inputOrUrl}`);
    return username;
}

/**
 * Verifica el estado de un stream de Twitch.
 * @param {string} originalInput - La URL o nombre de usuario de Twitch.
 * @returns {Promise<object>} Un objeto con la información del stream.
 */
async function getTwitchStreamStatus(originalInput) {
    console.log(`api_twitch.js: Iniciando verificación para Twitch input: ${originalInput}`);

    if (!TWITCH_CLIENT_ID || TWITCH_CLIENT_ID === 'TU_TWITCH_CLIENT_ID_AQUI' ||
        !TWITCH_APP_ACCESS_TOKEN || TWITCH_APP_ACCESS_TOKEN === 'TU_TWITCH_APP_ACCESS_TOKEN_AQUI') {
        console.error('api_twitch.js: Client ID o App Access Token de Twitch no configurados.');
        return { platform: 'twitch', identifier: originalInput, name: originalInput, originalInput: originalInput, status: 'Error Config.', details: 'Credenciales de Twitch no configuradas.', lastCheck: new Date().toLocaleTimeString() };
    }

    const username = getTwitchUsername(originalInput);

    const streamInfo = {
        platform: 'twitch',
        identifier: username,    // El username extraído
        name: originalInput,   // Por defecto el input original, se intentará mejorar
        originalInput: originalInput, // Para el ID de fila en ui.js
        status: 'Offline',
        lastCheck: new Date().toLocaleTimeString(),
        title: null,
        details: null, // Podría ser el nombre del juego
        viewers: null
    };

    if (!username) {
        streamInfo.status = 'Error';
        streamInfo.details = 'Input de Twitch inválido o no extraíble.';
        return streamInfo;
    }

    const apiUrl = `https://api.twitch.tv/helix/streams?user_login=${username.toLowerCase()}`; // user_login es sensible a mayúsculas/minúsculas según la API, pero Twitch suele normalizar.
    console.log("api_twitch.js: Llamando a URL de API Twitch:", apiUrl);

    try {
        const response = await fetch(apiUrl, {
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${TWITCH_APP_ACCESS_TOKEN}`
            }
        });

        const data = await response.json(); // Intentar parsear JSON incluso si no es ok, para ver el error
        console.log("api_twitch.js: Datos recibidos de API Twitch:", data);

        if (!response.ok) {
            streamInfo.status = 'Error API';
            streamInfo.details = `Twitch API Error (${response.status}): ${data.message || response.statusText}`;
            console.error(`api_twitch.js: ${streamInfo.details}`, data);
            return streamInfo;
        }

        if (data.data && data.data.length > 0) {
            const streamData = data.data[0];
            streamInfo.status = 'Live';
            streamInfo.name = streamData.user_name; // Nombre oficial con mayúsculas/minúsculas
            streamInfo.identifier = streamData.user_login; // login name (usualmente minúsculas)
            streamInfo.title = streamData.title;
            streamInfo.details = streamData.game_name || 'Sin categoría';
            streamInfo.viewers = streamData.viewer_count;
        } else {
            // Si data.data está vacío, el usuario está offline o no existe
            // Podríamos hacer una llamada adicional a /users para ver si el usuario existe
            // pero por ahora, simplemente lo marcamos como Offline.
            streamInfo.status = 'Offline';
            streamInfo.name = username; // Mantener el nombre ingresado si no se pudo obtener de la API
        }

    } catch (error) {
        console.error('api_twitch.js: Error al contactar API de Twitch o parsear JSON:', error);
        streamInfo.status = 'Error';
        streamInfo.details = 'Fallo de conexión o parsing con API de Twitch.';
    }
    streamInfo.lastCheck = new Date().toLocaleTimeString();
    return streamInfo;
}