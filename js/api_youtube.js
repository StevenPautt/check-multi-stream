// js/api_youtube.js

/**
 * Contains logic to interact with the YouTube API
 * and check stream status.
 *
 * IMPORTANT: This code is conceptual. You will need your own API Key
 * and should handle authentication and errors robustly.
 */

// YouTube API Key is now passed as a parameter to getYouTubeStreamStatus

/**
 * Parses a YouTube URL to extract a relevant identifier.
 * @param {string} urlInput - The full YouTube URL or a direct identifier.
 * @returns {{type: string, value: string, originalInput: string}} Object with type and value.
 * Types can be: 'channelId', 'customUrlName', 'handleName', 'videoId', 'unknownInput', 'directNameOrHandle', 'unknownUrlFormat'.
 */
function parseYouTubeUrl(urlInput) {
    const original = urlInput; 
    if (!urlInput || typeof urlInput !== 'string') {
        console.warn('api_youtube.js: Invalid input for parseYouTubeUrl:', urlInput);
        return { type: 'unknownInput', value: original, originalInput: original };
    }

    if (urlInput.startsWith('UC') && urlInput.length === 24) {
        return { type: 'channelId', value: urlInput, originalInput: original };
    }
    if (urlInput.match(/^[a-zA-Z0-9_-]{11}$/)) {
        return { type: 'videoId', value: urlInput, originalInput: original };
    }

    try {
        const normalizedUrl = urlInput.toLowerCase().startsWith('http') ? urlInput : `https://${urlInput}`;
        const url = new URL(normalizedUrl);

        if (url.hostname.includes('youtube.com/c/ChannelName7') || url.hostname.includes('youtu.be/')) {
            const pathname = url.pathname;
            const searchParams = url.searchParams;

            if (pathname.startsWith('/watch') && searchParams.has('v')) {
                return { type: 'videoId', value: searchParams.get('v'), originalInput: original };
            }
            const liveMatch = pathname.match(/^\/live\/([a-zA-Z0-9_-]+)/);
            if (liveMatch && liveMatch[1]) {
                return { type: 'videoId', value: liveMatch[1], originalInput: original };
            }
            if (url.hostname.includes('youtu.be/') && pathname.length > 1 && !pathname.substring(1).includes('/')) {
                return { type: 'videoId', value: pathname.substring(1), originalInput: original };
            }
            const channelMatch = pathname.match(/^\/channel\/([a-zA-Z0-9_-]{24})/);
            if (channelMatch && channelMatch[1]) {
                return { type: 'channelId', value: channelMatch[1], originalInput: original };
            }
            const customUrlMatch = pathname.match(/^\/(c|user)\/([a-zA-Z0-9_-]+)/);
            if (customUrlMatch && customUrlMatch[2]) {
                return { type: 'customUrlName', value: customUrlMatch[2], originalInput: original };
            }
            const handleMatch = pathname.match(/^\/(@[a-zA-Z0-9_.-]+)/);
            if (handleMatch && handleMatch[1]) {
                return { type: 'handleName', value: handleMatch[1].substring(1), originalInput: original };
            }
            const pathParts = pathname.split('/').filter(part => part.length > 0);
            if (pathParts.length === 1 && !searchParams.toString() && !pathParts[0].startsWith('UC') && !pathParts[0].match(/^[a-zA-Z0-9_-]{11}$/)) {
                 return { type: 'handleName', value: pathParts[0], originalInput: original };
             }
            console.warn(`api_youtube.js: YouTube URL format not clearly recognized: ${urlInput}`);
            return { type: 'unknownUrlFormat', value: urlInput, originalInput: original };
        }
    } catch (error) {
        console.warn(`api_youtube.js: Could not parse as YouTube URL: "${urlInput}". Treating as direct identifier.`, error.message);
        return { type: 'directNameOrHandle', value: urlInput, originalInput: original };
    }
    console.warn(`api_youtube.js: YouTube input not recognized as URL or known ID format: ${urlInput}`);
    return { type: 'unknownInput', value: urlInput, originalInput: original };
}

/**
 * Checks the status of a YouTube stream.
 * @param {string} originalUrlOrIdentifier - The original URL or identifier provided by the user.
 * @param {string} apiKey - The YouTube API Key provided by the user.
 * @returns {Promise<object>} An object with stream information.
 */
async function getYouTubeStreamStatus(originalUrlOrIdentifier, apiKey) {
    console.log(`api_youtube.js: Starting verification for input: "${originalUrlOrIdentifier}" using API Key: ${apiKey ? 'YES' : 'NO'}`);

    const streamInfoBase = {
        platform: 'youtube',
        identifier: originalUrlOrIdentifier,
        name: originalUrlOrIdentifier,
        originalInput: originalUrlOrIdentifier,
        status: 'Error', 
        lastCheck: new Date().toLocaleTimeString('en-US'),
        title: null,
        details: 'Error initializing check.',
        viewers: null
    };

    if (!apiKey) {
        console.error('api_youtube.js: YouTube API Key not provided for the call.');
        streamInfoBase.status = 'Config Error'; // English
        streamInfoBase.details = 'YouTube API Key not provided.'; // English
        return streamInfoBase;
    }

    const parsed = parseYouTubeUrl(originalUrlOrIdentifier);
    console.log(`api_youtube.js: URL parsing result:`, parsed);

    streamInfoBase.identifier = parsed.value;
    streamInfoBase.originalInput = parsed.originalInput;
    streamInfoBase.name = parsed.originalInput; 

    let channelIdToQuery = null;
    let videoIdToQuery = null;

    if (parsed.type === 'channelId') {
        channelIdToQuery = parsed.value;
    } else if (parsed.type === 'videoId') {
        videoIdToQuery = parsed.value;
    } else if (['customUrlName', 'handleName', 'legacyOrHandle', 'directNameOrHandle', 'unknownInput', 'unknownUrlFormat'].includes(parsed.type) && parsed.value) {
        console.log(`api_youtube.js: Attempting to resolve '${parsed.value}' (type: ${parsed.type}) to Channel ID...`);
        const resolveUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(parsed.value)}&type=channel&maxResults=1&key=${apiKey}`;
        console.log("api_youtube.js: Resolution URL:", resolveUrl);
        try {
            const resolveResponse = await fetch(resolveUrl);
            const resolveData = await resolveResponse.json();
            console.log("api_youtube.js: Resolution response:", JSON.parse(JSON.stringify(resolveData)));

            if (!resolveResponse.ok) {
                streamInfoBase.status = 'API Error';
                streamInfoBase.details = `Resolution failed (${resolveResponse.status}): ${resolveData.error?.message || resolveResponse.statusText}`;
                return streamInfoBase;
            }
            if (resolveData.items && resolveData.items.length > 0 && resolveData.items[0].id.kind === 'youtube#channel') {
                channelIdToQuery = resolveData.items[0].id.channelId;
                streamInfoBase.name = resolveData.items[0].snippet.title; 
                streamInfoBase.identifier = channelIdToQuery; 
                console.log(`api_youtube.js: Resolved to Channel ID: ${channelIdToQuery} (${streamInfoBase.name})`);
            } else {
                console.warn(`api_youtube.js: Could not resolve '${parsed.value}' to a Channel ID via search.`);
                streamInfoBase.status = 'Error';
                streamInfoBase.details = 'Channel not found by name/handle.'; // English
                return streamInfoBase;
            }
        } catch (resolveError) {
            console.error('api_youtube.js: Error during Channel ID resolution:', resolveError);
            streamInfoBase.status = 'Error';
            streamInfoBase.details = 'Connection failure while resolving Channel ID.'; // English
            return streamInfoBase;
        }
    } else { 
        streamInfoBase.status = 'Error';
        streamInfoBase.details = `YouTube input format not recognized or invalid: ${parsed.type}`; // English
        return streamInfoBase;
    }

    const finalStreamInfo = { ...streamInfoBase, status: 'Offline' }; 

    try {
        let statusApiUrl;
        if (videoIdToQuery) {
            console.log(`api_youtube.js: Checking Video ID: ${videoIdToQuery}`);
            statusApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails,statistics&id=${videoIdToQuery}&key=${apiKey}`;
        } else if (channelIdToQuery) {
            console.log(`api_youtube.js: Searching for live streams for Channel ID: ${channelIdToQuery}`);
            statusApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelIdToQuery}&eventType=live&type=video&maxResults=1&key=${apiKey}`;
        } else {
            finalStreamInfo.status = 'Error';
            finalStreamInfo.details = 'No valid Channel ID or Video ID to query.'; // English
            return finalStreamInfo;
        }

        console.log("api_youtube.js: Status URL:", statusApiUrl);
        const statusResponse = await fetch(statusApiUrl);
        const statusData = await statusResponse.json();
        console.log("api_youtube.js: Status response:", JSON.parse(JSON.stringify(statusData)));

        if (!statusResponse.ok) {
            if (statusData.error && statusData.error.errors && statusData.error.errors[0] && statusData.error.errors[0].reason === 'quotaExceeded') {
                finalStreamInfo.status = 'API Error';
                finalStreamInfo.details = 'YouTube API quota exceeded.'; // English
            } else {
                finalStreamInfo.status = 'API Error';
                finalStreamInfo.details = `Status check failed (${statusResponse.status}): ${statusData.error?.message || statusResponse.statusText}`;
            }
            return finalStreamInfo;
        }

        if (statusData.items && statusData.items.length > 0) {
            const item = statusData.items[0];
            if (videoIdToQuery) { 
                if (item.snippet && item.liveStreamingDetails && item.liveStreamingDetails.actualStartTime && !item.liveStreamingDetails.actualEndTime) {
                    finalStreamInfo.status = 'Live';
                    finalStreamInfo.title = item.snippet.title;
                    finalStreamInfo.name = item.snippet.channelTitle; 
                    if(item.liveStreamingDetails.concurrentViewers) {
                        finalStreamInfo.viewers = parseInt(item.liveStreamingDetails.concurrentViewers);
                    }
                } else {
                    finalStreamInfo.status = 'Offline';
                    finalStreamInfo.details = 'Video is not live or has ended.'; // English
                }
            } else { // Response from search.list (for channelIdToQuery)
                finalStreamInfo.status = 'Live';
                finalStreamInfo.title = item.snippet.title;
                // finalStreamInfo.name was already set during Channel ID resolution
            }
        } else {
            finalStreamInfo.status = 'Offline';
            if (channelIdToQuery) finalStreamInfo.details = 'Channel is not currently live or no live streams found.'; // English
            if (videoIdToQuery) finalStreamInfo.details = 'Video not found or not accessible.'; // English
        }
    } catch (error) {
        console.error('api_youtube.js: Error checking stream status:', error);
        finalStreamInfo.status = 'Error';
        finalStreamInfo.details = 'Connection or parsing failure while checking status.'; // English
    }
    finalStreamInfo.lastCheck = new Date().toLocaleTimeString('en-US');
    return finalStreamInfo;
}