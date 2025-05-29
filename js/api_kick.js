// js/api_kick.js

/**
 * Contains logic to interact with Kick's public API
 * and check stream status.
 * Endpoint: https://kick.com/api/v2/channels/{username}
 *
 * NOTE: This is a public API and might change without notice.
 */

function getKickUsername(inputOrUrl) {
    if (!inputOrUrl || typeof inputOrUrl !== 'string') return null;
    let username = inputOrUrl;
    if (inputOrUrl.toLowerCase().includes('kick.com/')) {
        try {
            const url = new URL(inputOrUrl.startsWith('http') ? inputOrUrl : `https://${inputOrUrl}`);
            const pathParts = url.pathname.split('/').filter(part => part.length > 0);
            if (pathParts.length > 0) username = pathParts[0];
        } catch (error) {
            console.warn(`api_kick.js: Could not parse as Kick URL: "${inputOrUrl}". Using as direct username.`, error.message);
        }
    }
    username = username.split('?')[0];
    console.log(`api_kick.js: Kick username extracted/used: ${username} for input: ${inputOrUrl}`);
    return username;
}

async function getKickStreamStatus(originalInput) {
    console.log(`api_kick.js: Starting verification for Kick input: ${originalInput}`);
    const username = getKickUsername(originalInput);

    const streamInfo = {
        platform: 'kick',
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
        streamInfo.details = 'Invalid or unextractable Kick input.'; // English
        return streamInfo;
    }

    const apiUrl = `https://kick.com/api/v2/channels/${username.toLowerCase()}`;
    console.log("api_kick.js: Calling Kick API URL:", apiUrl);

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            if (response.status === 404) {
                streamInfo.status = 'Offline'; 
                streamInfo.details = 'Channel not found on Kick or does not exist.'; // English
            } else {
                streamInfo.status = 'API Error';
                streamInfo.details = `Kick API Error: ${response.status} ${response.statusText}`;
            }
            const errorDataText = await response.text();
            console.error(`api_kick.js: ${streamInfo.details}`, errorDataText);
            return streamInfo;
        }

        const data = await response.json();
        console.log("api_kick.js: Data received from Kick API:", data);

        if (data && data.user && data.user.username) {
            streamInfo.name = data.user.username; 
            streamInfo.identifier = data.user.username; 
        }

        if (data && data.livestream) { 
            streamInfo.status = 'Live';
            streamInfo.title = data.livestream.session_title || 'Live Stream'; // English
            streamInfo.viewers = data.livestream.viewer_count;
            // streamInfo.details = data.livestream.categories?.[0]?.name; // Example: get category
        } else {
            streamInfo.status = 'Offline';
        }

    } catch (error) {
        console.error('api_kick.js: Error contacting Kick API or parsing JSON:', error);
        streamInfo.status = 'Error';
        streamInfo.details = 'Connection or parsing failure with Kick API.'; // English
    }
    streamInfo.lastCheck = new Date().toLocaleTimeString('en-US');
    return streamInfo;
}