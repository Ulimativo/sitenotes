// Aktive Tabs und ihre Start-Zeiten
let activeTabs = new Map();
let focusedTabId = null;
let isWindowFocused = true;

// Hilfsfunktion zum Überprüfen des aktiven Status
function isTabActive(tabId) {
  return focusedTabId === tabId && isWindowFocused;
}

// Listener für Tab-Aktivierung
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Vorherigen Tab stoppen
  if (focusedTabId) {
    await updateTimeForTab(focusedTabId);
  }

  focusedTabId = activeInfo.tabId;
  const tab = await chrome.tabs.get(activeInfo.tabId);

  if (tab.url) {
    const hostname = new URL(tab.url).hostname;
    activeTabs.set(activeInfo.tabId, {
      hostname,
      startTime: isWindowFocused ? Date.now() : null,
    });
  }
});

// Listener für Tab-Updates (URL-Änderungen)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    // Alte URL-Zeit speichern wenn es der aktive Tab war
    if (isTabActive(tabId)) {
      await updateTimeForTab(tabId);
    }

    const hostname = new URL(changeInfo.url).hostname;
    activeTabs.set(tabId, {
      hostname,
      startTime: isTabActive(tabId) ? Date.now() : null,
    });
  }
});

// Listener für Tab-Schließung
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (isTabActive(tabId)) {
    await updateTimeForTab(tabId);
    focusedTabId = null;
  }
  activeTabs.delete(tabId);
});

// Listener für Browser-Fokus-Änderung
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser verliert Fokus
    isWindowFocused = false;
    if (focusedTabId) {
      await updateTimeForTab(focusedTabId);
      const tabInfo = activeTabs.get(focusedTabId);
      if (tabInfo) {
        tabInfo.startTime = null;
      }
    }
  } else {
    // Browser erhält Fokus
    isWindowFocused = true;
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url) {
      focusedTabId = tabs[0].id;
      const hostname = new URL(tabs[0].url).hostname;
      activeTabs.set(tabs[0].id, {
        hostname,
        startTime: Date.now(),
      });
    }
  }
});

// Update Zeit für einen spezifischen Tab
async function updateTimeForTab(tabId) {
  const tabInfo = activeTabs.get(tabId);
  if (!tabInfo || !tabInfo.startTime) return;

  const timeSpent = Math.floor((Date.now() - tabInfo.startTime) / 1000);
  if (timeSpent <= 0) return;

  const data = await chrome.storage.local.get([`time_${tabInfo.hostname}`]);
  const timeData = data[`time_${tabInfo.hostname}`] || {
    totalTime: 0,
    lastVisit: Date.now(),
  };

  timeData.totalTime += timeSpent;
  timeData.lastVisit = Date.now();

  await chrome.storage.local.set({
    [`time_${tabInfo.hostname}`]: timeData,
  });

  // Reset startTime nach dem Update
  tabInfo.startTime = isTabActive(tabId) ? Date.now() : null;
}

// Regelmäßiges Update der aktiven Zeit
setInterval(async () => {
  if (focusedTabId && isWindowFocused) {
    await updateTimeForTab(focusedTabId);
  }
}, 30000);

// Initialisierung beim Start
chrome.runtime.onStartup.addListener(async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0] && tabs[0].url) {
    focusedTabId = tabs[0].id;
    const hostname = new URL(tabs[0].url).hostname;
    activeTabs.set(tabs[0].id, {
      hostname,
      startTime: Date.now(),
    });
  }
});
