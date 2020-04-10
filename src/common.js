"use strict";

async function getFromStorage(name) {
    let result = await browser.storage.sync.get(name);
    if (name in result) {
        return result[name];
    }
    return null;
}