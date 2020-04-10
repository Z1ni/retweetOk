"use strict";

async function loadOptions() {
    let [blockedIds, stats] = await Promise.all([
        getFromStorage("blockedUserIds"),
        getFromStorage("stats")
    ]);

    if (blockedIds != null) {
        let blockIdListElem = document.getElementById("blockList");
        blockIdListElem.innerHTML = "";
        for (let blocked of blockedIds) {
            let liElem = document.createElement("li");
            let delBtnElem = document.createElement("button");
            delBtnElem.setAttribute("data-uid", blocked);
            delBtnElem.innerText = "Remove";
            liElem.innerText = blocked;
            liElem.appendChild(delBtnElem);
            blockIdListElem.appendChild(liElem);
            delBtnElem.addEventListener("click", removeButtonClick);
        }
    }

    if (stats == null) {
        return;
    }
    let blockedCountElem = document.getElementById("blockedTweets");
    blockedCountElem.innerText = stats.blockedCount;
}

async function removeButtonClick(el) {
    let btn = el.target;
    let uid = btn.getAttribute("data-uid");

    try {
        let blockedUids = await getFromStorage("blockedUserIds");

        let idx = blockedUids.indexOf(uid);
        if (idx > -1) {
            blockedUids.splice(idx, 1);
            browser.storage.sync.set({ blockedUserIds: blockedUids });
            notifyBlocklistUpdate(blockedUids);
        }
        await loadOptions();
    } catch (err) {
        console.error(`Failed to remove item from blocklist: ${err}`);
    }
}

async function addBlockedUserId() {
    let userIdTextElem = document.getElementById("userId");
    let userId = userIdTextElem.value.trim();
    if (userId.length == 0) {
        return;
    }

    // Check if the user ID is acceptable
    if (!/^\d+$/.test(userId)) {
        // Not acceptable
        console.warn("Invalid user ID, must be numeric");
        return;
    }

    userIdTextElem.value = "";

    try {
        let blockedUids = await getFromStorage("blockedUserIds");
        blockedUids.push(userId);
        browser.storage.sync.set({ blockedUserIds: blockedUids });
        await loadOptions();
        notifyBlocklistUpdate(blockedUids);
    } catch (err) {
        console.error(`Failed to add item to blocklist: ${err}`);
    }
}

function notifyBlocklistUpdate(blockedUids) {
    // Send message to the background script
    browser.runtime.sendMessage({ blockedUids });
}

document.addEventListener("DOMContentLoaded", loadOptions);
document.getElementById("addUserId").addEventListener("click", addBlockedUserId);