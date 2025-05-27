const toggleButton = document.getElementById('toggleButton');
const showcaseButton = document.getElementById('showcaseButton');
const editButton = document.getElementById('editButton');
const siteNameSpan = document.getElementById('siteName');

let currentHostname = null;

// Update button state and text
function updateButtonState(hostname, enabled) {
    console.log(`[Popup] Updating button. Host: ${hostname}, Enabled: ${enabled}`);
    currentHostname = hostname; // Still need this for sending.

    if (hostname && hostname !== "Non-Web Page" && hostname !== "Error") {
        siteNameSpan.textContent = hostname;
        toggleButton.disabled = false;
        if (enabled) {
            toggleButton.textContent = `Disable Theme for ${hostname}`;
            toggleButton.classList.remove('disabled');
        } else {
            toggleButton.textContent = `Enable Theme for ${hostname}`;
            toggleButton.classList.add('disabled');
        }
    } else {
        siteNameSpan.textContent = hostname || "No active page";
        toggleButton.textContent = "Toggle Theme";
        toggleButton.disabled = true;
    }
}

// Function to initialize the popup
async function initializePopup() {
    console.log("[Popup] Initializing...");
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        console.log("[Popup] Queried Tabs:", tabs);

        if (tabs.length > 0 && tabs[0].url) {
            const url = tabs[0].url;

            if (url.startsWith("http:") || url.startsWith("https:")) {
                const urlObj = new URL(url);
                let hostname = urlObj.hostname.startsWith('www.') ? urlObj.hostname.substring(4) : urlObj.hostname;
                currentHostname = hostname; // Set global hostname here
                console.log(`[Popup] Got hostname: ${hostname}. Reading storage.`);

                // Read storage directly
                const data = await browser.storage.local.get('disabledSites');
                const disabledSites = data.disabledSites || {};
                const isDisabled = !!disabledSites[hostname];
                console.log(`[Popup] Read storage. Disabled: ${isDisabled}`);

                updateButtonState(hostname, !isDisabled); // Update with `enabled` state

            } else {
                console.log("[Popup] Non-Web Page found.");
                updateButtonState("Non-Web Page", false);
            }
        } else {
            console.log("[Popup] No active page found.");
            updateButtonState("No active page", false);
        }
    } catch (e) {
         console.error("[Popup] Error initializing popup:", e);
         updateButtonState("Error", false);
    }
}

// Toggle button click handler
toggleButton.addEventListener('click', async () => {
    if (!currentHostname || currentHostname === "Non-Web Page" || currentHostname === "Error") {
        return; // Do nothing if no valid host
    }

    // Read storage *again* to get the very latest state before deciding
    const data = await browser.storage.local.get('disabledSites');
    const disabledSites = data.disabledSites || {};
    const isCurrentlyDisabled = !!disabledSites[currentHostname];

    // If it's disabled, we want it enabled (true). If it's enabled, we want it disabled (false).
    const wantItEnabled = isCurrentlyDisabled;

    console.log(`[Popup] Click! Host: ${currentHostname}, IsCurrentlyDisabled: ${isCurrentlyDisabled}, Sending Enabled: ${wantItEnabled}`);

    // Send message to background to DO the toggle and reload (fire and forget)
    browser.runtime.sendMessage({
        action: "toggleSiteAndReload",
        hostname: currentHostname,
        enabled: wantItEnabled // Send the *new* desired state
    }).catch(e => console.error("[Popup] Error sending toggle message:", e)); // Log errors, but don't wait

    // Close the popup immediately
    window.close();
});

// Showcase button click handler
showcaseButton.addEventListener('click', () => {
    browser.tabs.create({ url: browser.runtime.getURL('showcase/index.html') });
    window.close();
});

// Edit button click handler
editButton.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
    window.close();
});

// Run initialization when the popup loads
document.addEventListener('DOMContentLoaded', initializePopup);

console.log("[Popup] popup.js loaded.");
