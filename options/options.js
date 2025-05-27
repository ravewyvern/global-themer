// Get DOM elements
const editorElement = document.getElementById('cssEditor');
const saveButton = document.getElementById('saveButton');
const resetButton = document.getElementById('resetButton');
const statusDiv = document.getElementById('status');

// Constants
const THEME_CSS_KEY = 'customThemeCSS';
const BUNDLED_PATH = '../themes/theme.css';

// --- Utility: Debounce function ---
function debounce(func, wait, immediate) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

// Check if CodeMirror and Pickr are loaded (basic check)
if (typeof CodeMirror === 'undefined' || typeof Pickr === 'undefined') {
    console.error("CodeMirror or Pickr is not loaded! Check HTML links.");
    alert("Error: Editor libraries not loaded. Please check console.");
}

// Initialize CodeMirror
const codeMirrorInstance = CodeMirror.fromTextArea(editorElement, {
    lineNumbers: true,
    mode: "css",
    theme: "default",
    indentUnit: 2,
    tabSize: 2,
    autoCloseBrackets: true,
    matchBrackets: true
});

// State variables for Pickr and swatches
let pickrInstance = null;
let currentMarkers = [];
let isPickerOpen = false;

// --- Function to show the color picker ---
function showPicker(marker, initialColor) {
    if (pickrInstance) {
        pickrInstance.destroyAndRemove();
    }
    const tempEl = document.createElement('div');
    document.body.appendChild(tempEl);
    isPickerOpen = true;

    pickrInstance = Pickr.create({
        el: tempEl,
        theme: 'nano', // Using 'nano'. Ensure nano.min.css is loaded!
        default: initialColor,
        swatches: [
            '#4f46e5', '#6b7280', '#d1d5db', '#10b981', '#f59e0b', '#ef4444',
            '#3b82f6', '#f9fafb', '#111827', '#ffffff', '#000000'
        ],
        components: {
            preview: true, opacity: true, hue: true,
            interaction: { hex: true, rgba: true, hsla: false, hsva: false, cmyk: false, input: true, clear: false, save: true }
        },
        useAsButton: false,
        appClass: 'pickr-popup',
        inline: false,
        showAlways: false,
        position: 'bottom-middle'
    });

    pickrInstance.on('save', (color, instance) => {
        isPickerOpen = false;
        const newHex = color.toHEXA().toString(0);
        const range = marker.find();
        console.log("[Pickr] Save. New Hex:", newHex, "Marker Range:", range);

        if (range && range.from && range.to) {
            codeMirrorInstance.getDoc().replaceRange(newHex, range.from, range.to);
        } else {
            console.error("[Pickr] Could not find marker range to replace color!");
        }

        instance.hide();
        setTimeout(() => {
             try { instance.destroyAndRemove(); document.body.removeChild(tempEl); } catch(e){}
             pickrInstance = null;
        }, 50);

    }).on('hide', (instance) => {
        isPickerOpen = false;
        setTimeout(() => {
            if (pickrInstance === instance) {
                try { instance.destroyAndRemove(); document.body.removeChild(tempEl); } catch(e){}
                pickrInstance = null;
            }
        }, 100);
    }).on('show', (color, instance) => {
        const range = marker.find();
        if (range) {
            const cmCoords = codeMirrorInstance.cursorCoords(range.from, 'page');
            const pickerEl = instance.getRoot().app;
            pickerEl.style.position = 'absolute';
            pickerEl.style.left = `${cmCoords.left}px`;
            pickerEl.style.top = `${cmCoords.bottom + 5}px`;
            pickerEl.style.zIndex = '1000';
        }
    });

    pickrInstance.show();
}

// --- Function to scan for colors and add swatches ---
function updateColorSwatches() {
    if (isPickerOpen) {
        console.log("Picker is open, skipping swatch update.");
        return;
    }

    codeMirrorInstance.operation(() => {
        currentMarkers.forEach(marker => marker.clear());
        currentMarkers = [];
        const doc = codeMirrorInstance.getDoc();
        const hexRegex = /#([a-f\d]{6}|[a-f\d]{3})\b/ig;
        doc.eachLine(lineHandle => {
            const line = lineHandle.text;
            const lineNo = doc.getLineNumber(lineHandle);
            let match;
            while ((match = hexRegex.exec(line)) !== null) {
                const hexColor = match[0];
                const from = { line: lineNo, ch: match.index };
                const swatch = document.createElement('span');
                swatch.className = 'color-swatch-widget';
                try { swatch.style.backgroundColor = hexColor; }
                catch (e) { continue; } // Skip invalid colors
                const marker = doc.setBookmark(from, { widget: swatch, insertLeft: true });
                currentMarkers.push(marker);
                (function(m, color) {
                    swatch.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showPicker(m, color);
                    });
                })(marker, hexColor);
            }
        });
    });
}

// --- Helper Functions ---
function showStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.color = isError
        ? 'var(--theme-color-danger, red)'
        : 'var(--theme-color-success, green)';
    setTimeout(() => { statusDiv.textContent = ''; }, 3000);
}

async function loadBundledTheme() {
    try {
        const url = browser.runtime.getURL(BUNDLED_PATH);
        const response = await fetch(url);
        if (response.ok) {
            return await response.text();
        } else {
            return `/* Could not load bundled ${BUNDLED_PATH} */`;
        }
    } catch (e) {
        console.error("Error fetching bundled theme:", e);
        return `/* Error loading bundled theme: ${e.message} */`;
    }
}

// --- Core Load Function ---
async function loadCss() {
    console.log("Loading CSS into editor...");
    try {
        const data = await browser.storage.local.get(THEME_CSS_KEY);
        let cssContent;
        if (data[THEME_CSS_KEY]) {
            cssContent = data[THEME_CSS_KEY];
            showStatus("Loaded theme from storage.");
        } else {
            cssContent = await loadBundledTheme();
            showStatus("Loaded bundled theme (no saved version found).");
        }
        codeMirrorInstance.setValue(cssContent || "/* Could not load CSS */");
        console.log("CSS loaded, refreshing and updating swatches...");
        setTimeout(() => {
            codeMirrorInstance.refresh();
            updateColorSwatches();
            console.log("Swatches updated.");
        }, 100);
    } catch (e) {
        console.error("Error in loadCss:", e);
        codeMirrorInstance.setValue(`/* Error loading CSS: ${e.message} */`);
    }
}

// --- Event Listeners ---
saveButton.addEventListener('click', async () => {
    const cssContent = codeMirrorInstance.getValue();
    try {
        await browser.storage.local.set({ [THEME_CSS_KEY]: cssContent });
        showStatus("Theme saved successfully!");
    } catch (e) {
        console.error("Error saving theme:", e);
        showStatus(`Error saving theme: ${e.message}`, true);
    }
});

resetButton.addEventListener('click', async () => {
    if (confirm("Are you sure you want to discard your saved theme and reset to the bundled version?")) {
       try {
            await browser.storage.local.remove(THEME_CSS_KEY);
            await loadCss(); // Reload the editor
            showStatus("Theme reset to bundled version.");
        } catch (e) {
            console.error("Error resetting theme:", e);
            showStatus(`Error resetting theme: ${e.message}`, true);
        }
    }
});

codeMirrorInstance.on('change', debounce(updateColorSwatches, 500));

// --- Initial load ---
loadCss();
console.log("options.js loaded and initialized.");
