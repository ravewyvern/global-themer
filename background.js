const THEMES_DIR = 'themes/';
const GLOBAL_THEME = 'theme.css';
const DISABLED_KEY = 'disabledSites';
const THEME_CSS_KEY = 'customThemeCSS';

// Function to get disabled sites (with logging)
async function getDisabledSites() {
  const data = await browser.storage.local.get(DISABLED_KEY);
  console.log("[ThemeStyler] Reading disabled sites:", data);
  return data[DISABLED_KEY] || {};
}

// Function to save disabled sites (with logging)
async function saveDisabledSites(sites) {
  console.log("[ThemeStyler] Saving disabled sites:", sites);
  await browser.storage.local.set({ [DISABLED_KEY]: sites });
}

// Function to check if a file exists (using fetch)
async function fileExists(filePath) {
  try {
    const url = browser.runtime.getURL(filePath);
    const response = await fetch(url);
    return response.ok;
  } catch (e) {
    return false;
  }
}

// Function to find the most specific CSS file for a URL
async function findSpecificCss(url) {
    // ... (This function remains the same as before) ...
    if (!url || (!url.startsWith('http:') && !url.startsWith('https:'))) { return null; }
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    if (hostname.startsWith('www.')) { hostname = hostname.substring(4); }
    const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
    for (let i = pathParts.length; i >= 0; i--) {
        const currentPath = pathParts.slice(0, i).join('|');
        const filename = currentPath ? `${hostname}|${currentPath}.css` : `${hostname}.css`;
        const fullPath = `${THEMES_DIR}${filename}`;
        if (await fileExists(fullPath)) {
            console.log(`[ThemeStyler] Found specific CSS: ${fullPath}`);
            return fullPath;
        }
    }
    console.log(`[ThemeStyler] No specific CSS found for ${hostname}`);
    return null;
}

// Function to inject CSS
async function applyStyles(tabId, url) {
    // ... (This function remains the same as before, including logging) ...
    console.log(`[ThemeStyler] Applying styles to Tab ${tabId} - ${url}`);
    const disabledSites = await getDisabledSites();
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.startsWith('www.') ? urlObj.hostname.substring(4) : urlObj.hostname;
    console.log(`[ThemeStyler] Checking ${hostname}. Disabled:`, !!disabledSites[hostname]);
    if (disabledSites[hostname]) {
        console.log(`[ThemeStyler] Styling disabled for ${hostname}`);
        return;
    }
    const storedTheme = await browser.storage.local.get(THEME_CSS_KEY);
    if (storedTheme[THEME_CSS_KEY]) {
        browser.tabs.insertCSS(tabId, { code: storedTheme[THEME_CSS_KEY], runAt: "document_start" }).catch(e => console.error("Inject CSS (storage) failed:", e));
    } else {
        const themePath = `${THEMES_DIR}${GLOBAL_THEME}`;
        if (await fileExists(themePath)) {
            browser.tabs.insertCSS(tabId, { file: themePath, runAt: "document_start" }).catch(e => console.error("Inject CSS (bundle) failed:", e));
        } else { console.warn('[ThemeStyler] theme.css not found!'); }
    }
    const specificCssFile = await findSpecificCss(url);
    if (specificCssFile) {
        browser.tabs.insertCSS(tabId, { file: specificCssFile, runAt: "document_start" }).catch(e => console.error("Inject specific CSS failed:", e));
    }
}

// Listen for tab updates (remains the same)
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status && (changeInfo.status === 'loading' || changeInfo.status === 'complete') && tab.url) {
       if (tab.url.startsWith("http:") || tab.url.startsWith("https:")) {
          applyStyles(tabId, tab.url);
       }
    }
});


// --- Updated Message Listener (Simpler) ---
browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "toggleSiteAndReload") {
        const disabledSites = await getDisabledSites();
        console.log(`[ThemeStyler] Toggling: ${request.hostname}. Wants to be enabled: ${request.enabled}. Current state:`, disabledSites);

        if (request.hostname) {
            if (request.enabled) {
                // If we want it enabled, DELETE it from the disabled list.
                delete disabledSites[request.hostname];
                console.log(`[ThemeStyler] -> Enabling ${request.hostname} (deleting key)`);
            } else {
                // If we want it disabled, ADD it to the disabled list.
                disabledSites[request.hostname] = true;
                console.log(`[ThemeStyler] -> Disabling ${request.hostname} (setting key to true)`);
            }

            await saveDisabledSites(disabledSites);

            // Reload the tab that sent the message (or the active one)
            let tabToReload = sender.tab ? sender.tab.id : null;
            try {
                if (!tabToReload) {
                    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                    if (tabs.length > 0) tabToReload = tabs[0].id;
                }
                if (tabToReload) {
                   console.log(`[ThemeStyler] Reloading tab ${tabToReload}`);
                   browser.tabs.reload(tabToReload);
                } else {
                   console.warn("[ThemeStyler] Could not find a tab to reload.");
                }
            } catch (e) { console.error("Failed to reload tab:", e); }
        }
        // IMPORTANT: We do NOT call sendResponse or return true,
        // because the popup isn't waiting for a response.
    }
});
