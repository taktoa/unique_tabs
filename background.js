// @flow

var delay = 5000;

var unique_tabs = {
    helpers: {
        joinStrings: function(listOfStrings) { return listOfStrings.join(""); }
    }
};

function abbreviatedUrl(tab) {
    return tab.url.length > 30
        ? tab.url.match(/^.{15}|.{15}$/g).join("...")
        : tab.url;
}

function compareUrls(left, right) {
    return left.replace(/#.*$/, "") == right.replace(/#.*$/, "");
}

function onCompleted(details) {
    if(details.frameId == 0 && details.url && details.url != "" && !details.url.match(/^chrome:\/\//)) {
        chrome.tabs.get(details.tabId, function(tab) {
            if(typeof tab == "undefined") { return null; }
            if(tab.url.match(/^view-source:/)) { return null; }

            chrome.tabs.getAllInWindow(tab.windowId, function(tabs) {
                var duplicates = tabs.filter(function(t) {
                    return compareUrls(t.url, details.url) && t.id != tab.id && !t.pinned && t.status == "complete";
                });
                if(duplicates.length) {
                    removeDuplicates(tab, duplicates);
                }
            });
        });
    }
}

function removeDuplicates(tab /* : any */, duplicates /* : any */) /* : void */ {
    var tab_or_tabs /* : string */ = duplicates.length > 1 ? "tabs" : "tab";
    var title = "Found " + duplicates.length + " duplicate " + tab_or_tabs + ".";
    var message = unique_tabs.helpers.joinStrings([
        duplicates.length, " ", tab_or_tabs, " containing ",
        abbreviatedUrl(tab),
        " will be closed."
    ]);
    var options = {
        type: "basic",
        iconUrl: "icon48.png",
        title: title,
        message: message,
        isClickable: true,
        buttons: [{title: "Cancel"}]
    };
    var notificationId = null;
    var removeTabs = function() {
        chrome.tabs.get(tab.id, function(t) {
            // only close tabs if triggering tab still open
            if(typeof t == "undefined") { return null; }

            // remove individual tabs because passing array that includes closed tabs fails silently
            duplicates.forEach(function(duplicate) {
                chrome.tabs.remove(duplicate.id);
            });
        });
        chrome.notifications.clear(notificationId, function() {});
    };
    var removeTabsTimer = window.setTimeout(removeTabs.bind(this), delay);

    chrome.notifications.create("", options, function(nId) {
        notificationId = nId;
    });

    chrome.notifications.onButtonClicked.addListener(function(nId, buttonIndex) {
        if(nId != notificationId) { return; }
        window.clearTimeout(removeTabsTimer);
        chrome.notifications.clear(notificationId, function(){});
        return false;
    });
}

chrome.webNavigation.onCompleted.addListener(onCompleted);
