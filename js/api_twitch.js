// js/api_twitch.js

/**
 * Contains logic to interact with the Twitch Helix API
 * and check stream status.
 *
 * IMPORTANT: You will need a Twitch Client ID and an App Access Token.
 * The App Access Token should ideally be fetched from a backend.
 * For testing, you can generate one manually and paste it, but DO NOT COMMIT IT TO A PUBLIC REPO!
 */

// --- REPLACE THESE VALUES WITH YOUR TWITCH CREDENTIALS!!! ---
const TWITCH_CLIENT_ID = '4m2u1209v5ktf2gf87iettde46ibmt';
const TWITCH_APP_ACCESS_TOKEN = 'iu2f1i0rzcnx292t404on7b4e70edn'; 

function getTwitchUsername(inputOrUrl) {
    if (!inputOrUrl || typeof inputOrUrl !== 'string') return null;
    let username = inputOrUrl;
    const lowerInput = inputOrUrl.toLowerCase();
    if (lowerInput.includes('twitch.tv/')) {
        try {
            let pathPart = lowerInput.startsWith('http') ? new URL(lowerInput).pathname : lowerInput;
            if (pathPart.startsWith('twitch.tv/')) pathPart = pathPart.substring('twitch.tv/'.length);
            else if (pathPart.startsWith('/')) pathPart = pathPart.substring(1);
            const pathSegments = pathPart.split('/').filter(part => part.length > 0);
            if (pathSegments.length > 0) username = pathSegments[0];
        } catch (error) {
            console.warn(`api_twitch.js: Could not parse as Twitch URL: "${inputOrUrl}". Using as direct username.`, error.message);
        }
    }
    username = username.split('?')[0];
    console.log(`api_twitch.js: Twitch username extracted/used: ${username} for input: ${inputOrUrl}`);
    return username;
}

async function getTwitchStreamStatus(originalInput) {
    console.log(`api_twitch.js: Starting verification for Twitch input: ${originalInput}`);

    if (!TWITCH_CLIENT_ID || TWITCH_CLIENT_ID === 'YOUR_TWITCH_CLIENT_ID_HERE' ||
        !TWITCH_APP_ACCESS_TOKEN || TWITCH_APP_ACCESS_TOKEN === 'YOUR_TWITCH_APP_ACCESS_TOKEN_HERE') {
        console.error('api_twitch.js: Twitch Client ID or App Access Token not configured.');
        return { platform: 'twitch', identifier: originalInput, name: originalInput, originalInput: originalInput, status: 'Config Error', details: 'Twitch credentials not configured.', lastCheck: new Date().toLocaleTimeString('en-US') };
    }

    const username = getTwitchUsername(originalInput);

    const streamInfo = {
        platform: 'twitch',
        identifier: username,    
        name: originalInput,   
        originalInput: originalInput,
        status: 'Offline',
        lastCheck: new Date().toLocaleTimeString('en-US'),
        title: null,
        details: null, 
        viewers: null
    };

    if (!username) {
        streamInfo.status = 'Error';
        streamInfo.details = 'Invalid or unextractable Twitch input.'; // English
        return streamInfo;
    }

    const apiUrl = `https://api.twitch.tv/helix/streams?user_login=${username.toLowerCase()}`;
    console.log("api_twitch.js: Calling Twitch API URL:", apiUrl);

    try {
        const response = await fetch(apiUrl, {
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${TWITCH_APP_ACCESS_TOKEN}`
            }
        });

        const data = await response.json();
        console.log("api_twitch.js: Data received from Twitch API:", data);

        if (!response.ok) {
            streamInfo.status = 'API Error';
            streamInfo.details = `Twitch API Error (${response.status}): ${data.message || response.statusText}`;
            console.error(`api_twitch.js: ${streamInfo.details}`, data);
            return streamInfo;
        }

        if (data.data && data.data.length > 0) {
            const streamData = data.data[0];
            streamInfo.status = 'Live';
            streamInfo.name = streamData.user_name; 
            streamInfo.identifier = streamData.user_login; 
            streamInfo.title = streamData.title;
            streamInfo.details = streamData.game_name || 'Not playing'; // English
            streamInfo.viewers = streamData.viewer_count;
        } else {
            streamInfo.status = 'Offline';
            streamInfo.name = username; 
        }

    } catch (error) {
        console.error('api_twitch.js: Error contacting Twitch API or parsing JSON:', error);
        streamInfo.status = 'Error';
        streamInfo.details = 'Connection or parsing failure with Twitch API.'; // English
    }
    streamInfo.lastCheck = new Date().toLocaleTimeString('en-US');
    return streamInfo;
}