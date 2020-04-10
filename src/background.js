"use strict";

// TODO: Use a class to wrap stuff in

let decoder = new TextDecoder("utf-8");
let encoder = new TextEncoder();
let blockedUserIds = [];

// Get blocked user IDs from storage
async function loadBlockedUserIds() {
    try {
        let blockedUserIds = await getFromStorage("blockedUserIds");
        return blockedUserIds == null ? [] : blockedUserIds;
    } catch (e) {
        console.err(`Failed to load blocked user IDs from storage: ${blockedUserIds}`);
        return [];
    }
}

// Update block count statistics, create the storage entry if needed
async function addToBlockCount(num) {
    try {
        let stats = await getFromStorage("stats");
        if (stats == null) {
            // Add stats
            browser.storage.sync.set({ stats: { blockedCount: num } });
        } else {
            // Update stats
            stats.blockedCount += num;
            browser.storage.sync.set({ stats });
        }
    } catch (err) {
        console.error(`Failed to update block stats: ${err}`);
    }
}

// Twitter API request listener
// This function intercepts all Twitter API requests bound for the timeline JSON data
// and modifies those if needed.
async function apiRequestListener(details) {
    let respFilter = browser.webRequest.filterResponseData(details.requestId);
    let data = [];

    respFilter.ondata = event => {
        data.push(event.data);
    };

    respFilter.onstop = async _ => {
        if (data.length == 0) {
            //console.log("Empty response");
            respFilter.disconnect();
            return;
        }
        //let modStart = performance.now();
        //console.log("Response received, modifying");
        let str = "";
        for (let buffer of data) {
            str += decoder.decode(buffer, { stream: true });
        }
        str += decoder.decode();
        // Modify response
        // Parse JSON
        let apiResp = JSON.parse(str);
        // Find tweets by the IDs in the blocklist
        let tweets = apiResp.globalObjects.tweets;
        let blockCount = 0;
        for (let tweetId in tweets) {
            let tweet = tweets[tweetId];
            // Retweets are OK, no need to filter
            if ("retweeted_status_id_str" in tweet) {
                //console.log(`Including retweet by ${tweet.user_id_str}`);
                continue;
            }
            // Check each tweet for blocked users
            if (blockedUserIds.includes(tweet.user_id_str)) {
                // Delete the tweet
                delete tweets[tweetId];
                console.info(`Tweet ${tweetId} by ${tweet.user_id_str} filtered`);
                blockCount++;
            }
        }
        // Re-construct the JSON if needed
        let newRespData = blockCount > 0 ? JSON.stringify(apiResp) : str;
        respFilter.write(encoder.encode(newRespData));
        respFilter.close();
        if (blockCount > 0) {
            await addToBlockCount(blockCount);
        }
        //let modEnd = performance.now();
        //console.log(`Modifying took ${modEnd - modStart} ms, changesMade: ${changesMade}`);
    };

    return { cancel: false };
}

// Listener for inter-extension messages from the options script
function messageListener(msg) {
    if (!("blockedUids" in msg)) {
        console.warn(`Got unknown message: ${msg}`);
        return;
    }
    blockedUserIds = msg.blockedUids;
    console.debug(`Blocked user IDs: ${blockedUserIds}`);
}

// Intercept only timeline requests
let apiFilter = {
    urls: ["https://api.twitter.com/2/timeline/home*.json*"],
    types: ["xmlhttprequest"]
};

// This is wrapped into an async function so we can use await when loading the user IDs initially
(async () => {
    blockedUserIds = await loadBlockedUserIds();
    console.debug(`Blocked user IDs: ${blockedUserIds}`);

    // Twitter API request listener
    browser.webRequest.onBeforeRequest.addListener(apiRequestListener, apiFilter, ["blocking"]);
    // Inter-extension message listener
    browser.runtime.onMessage.addListener(messageListener);
})();
