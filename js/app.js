// js/app.js

console.log("app.js: Script initiated and parsed by browser.");

document.addEventListener('DOMContentLoaded', () => {
    console.log("app.js: DOMContentLoaded event fired. HTML is ready.");

    if (typeof isUserLoggedIn === 'function' && !isUserLoggedIn()) {
        console.warn('app.js: User not authenticated. Redirecting to index.html...');
        window.location.href = 'index.html';
        return;
    } else if (typeof isUserLoggedIn !== 'function') {
        console.error("app.js: isUserLoggedIn() function is not defined. Ensure auth.js is loaded first.");
        return;
    }
    console.log("app.js: User authenticated. Continuing app initialization...");

    const urlInputArea = document.getElementById('urlInputArea');
    const checkStreamsButton = document.getElementById('checkStreamsButton');
    const logoutButton = document.getElementById('logoutButton');
    const filterByNameInput = document.getElementById('filterByName');
    const filterByPlatformSelect = document.getElementById('filterByPlatform');
    const youtubeApiKeyInput = document.getElementById('youtubeApiKeyInput');
    const saveApiKeyButton = document.getElementById('saveApiKeyButton');
    const youtubeApiKeyForm = document.getElementById('youtubeApiKeyForm');
    const manualRefreshButton = document.getElementById('manualRefreshButton');

    let monitoredStreams = []; 
    let refreshIntervalId = null;
    const REFRESH_INTERVAL_MS = 60000 * 5;
    
    let filterNameValue = '';
    let filterPlatformValue = '';

    const YT_API_KEY_LS = 'youtubeApiKey';
    const YT_QUOTA_COUNT_LS = 'youtubeQuotaCount';
    const YT_QUOTA_DATE_LS = 'youtubeQuotaDate';
    const YT_DAILY_QUOTA_LIMIT = 9000; 
    let currentYoutubeApiKey = '';

    console.log("app.js: State variables initialized.");

    function initializeApp() {
        console.log("app.js: initializeApp() called.");
        loadYoutubeApiKey();
        setupEventListeners();
        applyFiltersAndRender();
        console.log("app.js: initializeApp() completed.");
    }

    function loadYoutubeApiKey() {
        currentYoutubeApiKey = localStorage.getItem(YT_API_KEY_LS) || '';
        if (youtubeApiKeyInput) youtubeApiKeyInput.value = currentYoutubeApiKey;
        if (typeof uiUpdateApiKeyStatus === 'function') {
            uiUpdateApiKeyStatus(currentYoutubeApiKey ? 'YouTube API Key loaded from storage.' : 'No YouTube API Key configured.');
        }
        updateYoutubeQuotaStatus();
    }

    function saveYoutubeApiKeyAction(event) {
        if(event) event.preventDefault();
        if (youtubeApiKeyInput) {
            currentYoutubeApiKey = youtubeApiKeyInput.value.trim();
            if (currentYoutubeApiKey) {
                localStorage.setItem(YT_API_KEY_LS, currentYoutubeApiKey);
                if (typeof showAppMessage === 'function') showAppMessage('YouTube API Key saved!', 'success', 3000);
            } else {
                localStorage.removeItem(YT_API_KEY_LS);
                if (typeof showAppMessage === 'function') showAppMessage('YouTube API Key removed.', 'info', 3000);
            }
            if (typeof uiUpdateApiKeyStatus === 'function') {
                 uiUpdateApiKeyStatus(currentYoutubeApiKey ? 'YouTube API Key saved.' : 'YouTube API Key removed.');
            }
            resetYoutubeQuotaCount(); 
            updateYoutubeQuotaStatus();
        }
    }
    
    function updateYoutubeQuotaStatus() {
        if (!currentYoutubeApiKey) {
             if (typeof uiUpdateYoutubeQuotaStatus === 'function') uiUpdateYoutubeQuotaStatus('Set YouTube API Key to track quota.', false);
            return;
        }
        const count = getYoutubeQuotaCount();
        const remaining = YT_DAILY_QUOTA_LIMIT - count;
        const message = `YouTube API Quota: ~${count} units used. ~${remaining > 0 ? remaining : 0} remaining. (Resets daily PT)`;
        if (typeof uiUpdateYoutubeQuotaStatus === 'function') uiUpdateYoutubeQuotaStatus(message, remaining <= 0);
    }

    function getYoutubeQuotaCount() {
        const today = new Date().toISOString().split('T')[0];
        const savedDate = localStorage.getItem(YT_QUOTA_DATE_LS);
        if (savedDate !== today) {
            localStorage.setItem(YT_QUOTA_COUNT_LS, '0');
            localStorage.setItem(YT_QUOTA_DATE_LS, today);
            console.log("app.js: YouTube quota count reset for new day.");
            return 0;
        }
        return parseInt(localStorage.getItem(YT_QUOTA_COUNT_LS) || '0');
    }

    function incrementYoutubeQuotaCount(cost = 100) {
        if (!currentYoutubeApiKey) return getYoutubeQuotaCount();
        let count = getYoutubeQuotaCount();
        count += cost;
        localStorage.setItem(YT_QUOTA_COUNT_LS, count.toString());
        console.log(`app.js: YouTube quota incremented by ${cost}. New count: ${count}`);
        updateYoutubeQuotaStatus();
        return count;
    }
    
    function resetYoutubeQuotaCount(){
        console.log("app.js: Resetting YouTube quota count manually (e.g. new key).");
        localStorage.setItem(YT_QUOTA_COUNT_LS, '0');
        localStorage.setItem(YT_QUOTA_DATE_LS, new Date().toISOString().split('T')[0]);
        updateYoutubeQuotaStatus();
    }

    function setupEventListeners() {
        console.log("app.js: setupEventListeners() running.");
        if (checkStreamsButton) {
            checkStreamsButton.addEventListener('click', () => handleCheckStreams(true)); // true = force YouTube for initial load from textarea
        }
        if (manualRefreshButton) {
            manualRefreshButton.addEventListener('click', () => {
                console.log("app.js: Manual Refresh All button clicked.");
                if (monitoredStreams.length === 0) {
                    if(typeof showAppMessage === 'function') showAppMessage('No streams to refresh. Please add URLs first using "Check All (from Textarea)".', 'info');
                    return;
                }
                checkAllStreams(true); // true = force YouTube check
            });
        }
        if (youtubeApiKeyForm) {
            youtubeApiKeyForm.addEventListener('submit', saveYoutubeApiKeyAction);
        } else if (saveApiKeyButton) { // Fallback if form not found
             saveApiKeyButton.addEventListener('click', saveYoutubeApiKeyAction);
        }
        
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                if (refreshIntervalId) clearInterval(refreshIntervalId);
                if (typeof logoutUser === 'function') logoutUser();
            });
        }
        if (filterByNameInput) {
            filterByNameInput.addEventListener('input', (event) => {
                filterNameValue = event.target.value.toLowerCase();
                applyFiltersAndRender();
            });
        }
        if (filterByPlatformSelect) {
            filterByPlatformSelect.addEventListener('change', (event) => {
                filterPlatformValue = event.target.value;
                applyFiltersAndRender();
            });
        }
        console.log("app.js: setupEventListeners() completed.");
    }

    async function handleCheckStreams(isForceYouTubeCheck = false) { 
        console.log(`app.js: handleCheckStreams() called. Force YouTube: ${isForceYouTubeCheck}`);
        
        if (!urlInputArea) {
            console.error("app.js: urlInputArea element not found.");
            if (typeof showAppMessage === 'function') showAppMessage('Internal Error: URL input area not found.', 'danger');
            return;
        }
        const textContent = urlInputArea.value;

        if (!textContent.trim()) {
            if (typeof showAppMessage === 'function') showAppMessage('Please paste some URLs first.', 'warning');
            return;
        }

        if (typeof showLoadingIndicator === 'function') showLoadingIndicator(true);
        
        monitoredStreams = []; 
        if (typeof clearStreamTable === 'function') clearStreamTable();
        console.log("app.js: Monitored streams reset and table cleared.");

        if (textContent.trim()){
            const parsedInputs = parseInputLines(textContent);
            console.log("app.js: Parsed inputs from textarea:", JSON.parse(JSON.stringify(parsedInputs)));

            if (parsedInputs.length === 0) {
                if (typeof showAppMessage === 'function') showAppMessage('No valid URLs found in the input.', 'warning');
                applyFiltersAndRender(); 
                if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false);
                return;
            }
            if (typeof showAppMessage === 'function') showAppMessage(`Processing ${parsedInputs.length} entries...`, 'info', 3000);

            monitoredStreams = parsedInputs.map(input => ({
                platform: input.platform || 'unknown',
                identifier: input.url,          // This is the URL part from "Nickname, URL"
                name: input.nickname,           // This is the Nickname part, or the URL if no nickname
                originalInput: input.url,       // The URL part, used for stable row ID and link href
                nickname: input.nickname,       // Explicitly store the nickname
                status: 'Pending...',
                lastCheck: '-',
                title: null, viewers: null, details: null
            }));
            applyFiltersAndRender(); 
        } else if (monitoredStreams.length === 0) { 
             applyFiltersAndRender(); 
             if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false);
             return;
        }
        
        console.log("app.js: Initial streams populated for monitoring.");

        await checkAllStreams(isForceYouTubeCheck); 
        console.log("app.js: Stream check cycle completed.");

        if (refreshIntervalId) clearInterval(refreshIntervalId);
        refreshIntervalId = setInterval(() => checkAllStreams(false), REFRESH_INTERVAL_MS); 
        console.log("app.js: Refresh interval updated.");
        
        if (typeof updateGlobalLastCheckTime === 'function') updateGlobalLastCheckTime(new Date().toLocaleTimeString('en-US'));
        console.log("app.js: handleCheckStreams() finished.");
    }
    
    function parseInputLines(textContent) {
        console.log("app.js: parseInputLines() START.");
        const lines = textContent.split(/\r?\n/);
        const inputs = [];
        lines.forEach((line, index) => {
            const originalLine = line;
            let processedLine = line.trim(); 
            console.log(`DEBUG: Line ${index + 1} (original): [${originalLine}]`);

            if (processedLine === '' || processedLine.startsWith('#')) {
                console.log(`DEBUG: Line ${index + 1} ignored (empty or comment).`);
                return; 
            }

            let nickname = null;
            let urlPart = processedLine;
            const commaIndex = processedLine.indexOf(',');

            if (commaIndex !== -1) {
                nickname = processedLine.substring(0, commaIndex).trim();
                urlPart = processedLine.substring(commaIndex + 1).trim();
                console.log(`DEBUG: Line ${index + 1} - Parsed Nickname: "${nickname}", URL Part: "${urlPart}"`);
            } else {
                nickname = urlPart; // If no comma, use the whole line as nickname and URL
                console.log(`DEBUG: Line ${index + 1} - No comma, using "${urlPart}" as Nickname and URL.`);
            }
            
            // Apply aggressive cleaning to the urlPart
            let cleanedUrl = urlPart;
            const objectObjectString = "[Object Object]";
            if (cleanedUrl.endsWith(objectObjectString)) {
                console.warn(`DEBUG: Line ${index + 1} - Detected "${objectObjectString}" at the end of URL part. Cleaning.`);
                cleanedUrl = cleanedUrl.substring(0, cleanedUrl.length - objectObjectString.length).trim();
            }
            const urlPartsArray = cleanedUrl.split(/\s+/);
            if (urlPartsArray.length > 0 && (urlPartsArray[0].toLowerCase().startsWith('http://') || urlPartsArray[0].toLowerCase().startsWith('https://'))) {
                if (urlPartsArray.length > 1) {
                     console.warn(`DEBUG: Line ${index + 1} - Spaces detected after initial URL in URL part. Using first part: "${urlPartsArray[0]}"`);
                }
                cleanedUrl = urlPartsArray[0];
            }
            console.log(`DEBUG: Line ${index + 1} (cleanedUrl for platform detection): [${cleanedUrl}] (Length: ${cleanedUrl.length})`);
            
            const lowerUrl = cleanedUrl.toLowerCase();
            let platform = 'unknown';

            if (lowerUrl.includes('twitch.tv/')) platform = 'twitch';
            else if (lowerUrl.includes('youtube.com/') || lowerUrl.includes('youtu.be/')) platform = 'youtube';
            else if (lowerUrl.includes('kick.com/')) platform = 'kick';
            else if (lowerUrl.includes('facebook.com/')) platform = 'facebook';
            
            console.log(`DEBUG: Line ${index + 1} - Detected Platform: ${platform}`);
            inputs.push({ 
                nickname: nickname, 
                url: cleanedUrl, // This is the identifier for the API
                platform: platform,
                originalInputLine: originalLine // Keep the very original line for reference if needed
            });
        });
        console.log("app.js: parseInputLines() END. Detected inputs:", JSON.parse(JSON.stringify(inputs)));
        return inputs;
    }

    function applyFiltersAndRender() {
        if (!monitoredStreams) return;
        let streamsToDisplay = monitoredStreams;

        if (filterNameValue) {
            streamsToDisplay = streamsToDisplay.filter(stream =>
                (stream.nickname && stream.nickname.toLowerCase().includes(filterNameValue)) ||
                (stream.name && stream.name.toLowerCase().includes(filterNameValue)) || 
                (stream.identifier && stream.identifier.toLowerCase().includes(filterNameValue)) ||
                (stream.originalInput && stream.originalInput.toLowerCase().includes(filterNameValue)) ||
                (stream.title && stream.title.toLowerCase().includes(filterNameValue)) 
            );
        }
        if (filterPlatformValue) {
            streamsToDisplay = streamsToDisplay.filter(stream =>
                stream.platform && stream.platform.toLowerCase() === filterPlatformValue
            );
        }
        console.log("app.js: Displaying filtered streams:", JSON.parse(JSON.stringify(streamsToDisplay)));
        if (typeof displayStreamsInTable === 'function') {
            displayStreamsInTable(streamsToDisplay);
        } else {
            console.error("app.js: displayStreamsInTable is not defined in ui.js");
        }
    }

    async function processStreamCheck(streamEntry, index, isForceYouTubeCheck) { 
        const originalNicknameForLog = streamEntry.nickname;
        const urlForApi = streamEntry.identifier; 
        console.log(`app.js: processStreamCheck() for [${index}] (Nickname: ${originalNicknameForLog}, URL: ${urlForApi}, Platform: ${streamEntry.platform}, ForceYouTube: ${isForceYouTubeCheck})`);
        
        let streamApiFunction;
        const platformKey = streamEntry.platform.toLowerCase();

        if (platformKey === 'youtube' && !isForceYouTubeCheck) { 
            console.log("app.js: YouTube check skipped (not forced).");
            return; 
        }
        
        let apiKeyForYouTube = null;
        if (platformKey === 'youtube') {
            apiKeyForYouTube = currentYoutubeApiKey;
            if (!apiKeyForYouTube) {
                console.warn(`app.js: No API Key for YouTube for ${originalNicknameForLog}.`);
                monitoredStreams[index] = { ...streamEntry, status: 'Config Error', details: 'YouTube API Key needed.', lastCheck: new Date().toLocaleTimeString('en-US') };
                return; 
            }
            const quotaCount = getYoutubeQuotaCount();
            if (quotaCount >= YT_DAILY_QUOTA_LIMIT) {
                console.warn(`app.js: YouTube quota possibly exceeded for ${originalNicknameForLog}. Count: ${quotaCount}`);
                monitoredStreams[index] = { ...streamEntry, status: 'API Error', details: 'YouTube quota likely exceeded.', lastCheck: new Date().toLocaleTimeString('en-US') };
                updateYoutubeQuotaStatus(); 
                return;
            }
        }

        switch (platformKey) {
            case 'youtube': streamApiFunction = typeof getYouTubeStreamStatus === 'function' ? getYouTubeStreamStatus : null; break;
            case 'facebook': streamApiFunction = typeof getFacebookStreamStatus === 'function' ? getFacebookStreamStatus : null; break;
            case 'twitch': streamApiFunction = typeof getTwitchStreamStatus === 'function' ? getTwitchStreamStatus : null; break;
            case 'kick': streamApiFunction = typeof getKickStreamStatus === 'function' ? getKickStreamStatus : null; break;
            default:
                console.warn(`app.js: Unsupported platform: ${platformKey} for ${originalNicknameForLog}`);
                monitoredStreams[index] = { ...streamEntry, status: 'Unsupported', lastCheck: new Date().toLocaleTimeString('en-US') };
                return;
        }
        if (!streamApiFunction) {
            console.error(`app.js: API function not defined for ${platformKey}.`);
            monitoredStreams[index] = { ...streamEntry, status: 'Config Error', lastCheck: new Date().toLocaleTimeString('en-US') };
            return;
        }

        try {
            if (platformKey === 'youtube') {
                incrementYoutubeQuotaCount(100); 
            }
            const apiResponse = await streamApiFunction(urlForApi, platformKey === 'youtube' ? apiKeyForYouTube : undefined); 
            
            monitoredStreams[index] = {
                ...streamEntry,
                name: apiResponse.name || streamEntry.nickname, // API name, fallback to user's nickname
                identifier: apiResponse.identifier || urlForApi, 
                status: apiResponse.status || 'Unknown Error',
                title: apiResponse.title,
                viewers: apiResponse.viewers,
                details: apiResponse.details,
                platform: apiResponse.platform || streamEntry.platform, 
                lastCheck: new Date().toLocaleTimeString('en-US')
            };
            console.log(`app.js: API response for ${originalNicknameForLog}:`, JSON.parse(JSON.stringify(monitoredStreams[index])));
            
            if (platformKey === 'youtube' && monitoredStreams[index].details === 'Cuota de YouTube API excedida.') { // Check for exact Spanish message from conceptual API
                updateYoutubeQuotaStatus(); 
            } else if (platformKey === 'youtube' && monitoredStreams[index].details && monitoredStreams[index].details.toLowerCase().includes('quotaexceeded')) { // More generic check
                updateYoutubeQuotaStatus();
            }

        } catch (error) {
            console.error(`app.js: API call error for ${originalNicknameForLog}:`, error);
            monitoredStreams[index] = { ...streamEntry, status: 'API Error', lastCheck: new Date().toLocaleTimeString('en-US'), details: error.message };
        }
    }

    async function checkAllStreams(isForceYouTubeCheck = false) { 
        console.log(`app.js: checkAllStreams() called. Force YouTube: ${isForceYouTubeCheck}`);
        if (!monitoredStreams || monitoredStreams.length === 0) {
            applyFiltersAndRender();
            if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false);
            return;
        }
        if (typeof showLoadingIndicator === 'function') showLoadingIndicator(true);

        const promises = monitoredStreams.map((stream, i) => processStreamCheck(stream, i, isForceYouTubeCheck));

        try {
            await Promise.all(promises);
        } catch (error) {
            console.error("app.js: Error during Promise.all in checkAllStreams:", error);
            if (typeof showAppMessage === 'function') showAppMessage('Some checks failed during refresh.', 'warning');
        } finally {
            applyFiltersAndRender(); 
            if (typeof showLoadingIndicator === 'function') showLoadingIndicator(false);
            if (typeof updateGlobalLastCheckTime === 'function') updateGlobalLastCheckTime(new Date().toLocaleTimeString('en-US'));
            console.log("app.js: checkAllStreams() finished.");
        }
    }
    
    initializeApp();
    console.log("app.js: initializeApp() has been invoked.");
});

console.log("app.js: Script finished parsing. Waiting for DOMContentLoaded.");