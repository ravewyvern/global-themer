// side-panel/editor.js

(function() {
    if (document.getElementById('gt-editor-panel')) return;

    // --- State Management ---
    const state = {
        panelSide: 'right',
        isInspectMode: false,
        themeVariables: [],
    };

    // --- Main Initializer ---
    async function init() {
        state.themeVariables = await getThemeVariables();
        const panel = createPanel();
        document.body.appendChild(panel);
        pushPageContent(true);
        window.addEventListener('beforeunload', cleanup);
        processStylesheets(state.themeVariables);
    }

    // --- UI Creation & Management ---
    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'gt-editor-panel';
        panel.innerHTML = `
            <div class="gt-header">
                <div class="gt-header-top">
                    <h2>Theme Editor</h2>
                    <div class="gt-header-buttons">
                        <button class="gt-inspect-btn" title="Inspect Element">🎯</button>
                        <button class="gt-side-toggle-btn" title="Switch Side">↔</button>
                        <button class="gt-close-btn" title="Close Panel">×</button>
                    </div>
                </div>
            </div>
            <div class="gt-tabs">
                <button class="gt-tab-btn active" data-tab="editor">Editor</button>
                <button class="gt-tab-btn" data-tab="code">Generated Code</button>
            </div>
            <div id="gt-tab-editor" class="gt-tab-content active">
                <div class="gt-editor-content-wrapper">
                    <button id="gt-clear-filter-btn">Clear Inspector Filter</button>
                    <div class="gt-rules-container"></div>
                </div>
            </div>
            <div id="gt-tab-code" class="gt-tab-content">
                <div class="gt-code-content-wrapper">
                    <button id="gt-copy-code-btn">Copy</button>
                    <pre><code></code></pre>
                </div>
            </div>
        `;
        // Event Listeners
        panel.querySelector('.gt-close-btn').addEventListener('click', cleanup);
        panel.querySelector('.gt-side-toggle-btn').addEventListener('click', toggleSide);
        panel.querySelector('.gt-inspect-btn').addEventListener('click', toggleInspectMode);
        panel.querySelector('#gt-clear-filter-btn').addEventListener('click', clearInspectorFilter);
        panel.querySelector('#gt-copy-code-btn').addEventListener('click', copyGeneratedCode);
        panel.querySelectorAll('.gt-tab-btn').forEach(btn => btn.addEventListener('click', activateTab));
        return panel;
    }

    function createRuleUI(rule, themeVariables) {
        const block = document.createElement('div');
        block.className = 'gt-rule-block';
        block.dataset.selector = rule.selectorText;

        // The rest of this function is mostly the same...
        const propertyOptions = themeVariables.map(v => `<option value="var(${v})">${v}</option>`).join('');
        let propertiesHTML = '';
        for (let i = 0; i < rule.style.length; i++) {
            const propName = rule.style[i];
            const propValue = rule.style.getPropertyValue(propName);
            const truncatedValue = propValue.length > 25 ? propValue.substring(0, 25) + '...' : propValue;
            propertiesHTML += `
                <div class="gt-property">
                    <div class="gt-property-name">${propName}</div>
                    <div class="gt-property-value"><select data-property-name="${propName}">
                        <option value="${propValue}">Original: ${truncatedValue}</option>
                        ${propertyOptions}
                    </select></div>
                </div>`;
        }
        
        block.innerHTML = `
            <div class="gt-selector-header">
                <span class="gt-selector-text">${rule.selectorText}</span>
                <div class="gt-selector-controls">
                    <button class="gt-toggle-collapse-btn" title="Collapse">-</button>
                    <button class="gt-highlight-btn" title="Highlight elements">👁</button>
                </div>
            </div>
            <div class="gt-property-list">${propertiesHTML}</div>`;

        // Event Listeners for rule-specific buttons
        block.querySelector('.gt-highlight-btn').addEventListener('mouseover', () => toggleHighlight(rule.selectorText, true));
        block.querySelector('.gt-highlight-btn').addEventListener('mouseout', () => toggleHighlight(rule.selectorText, false));
        block.querySelector('.gt-toggle-collapse-btn').addEventListener('click', (e) => toggleCollapse(e.currentTarget));
        return block;
    }

    // --- Feature Logic ---

    // [4] Collapse Selectors
    function toggleCollapse(button) {
        const ruleBlock = button.closest('.gt-rule-block');
        const isCollapsed = ruleBlock.classList.toggle('is-collapsed');
        button.textContent = isCollapsed ? '+' : '-';
        button.title = isCollapsed ? 'Expand' : 'Collapse';
    }

    // [7] Toggle Panel Side
    function toggleSide() {
        const panel = document.getElementById('gt-editor-panel');
        state.panelSide = (state.panelSide === 'right') ? 'left' : 'right';
        panel.classList.toggle('is-left-side');
        pushPageContent(true); // Re-apply margins for the new side
    }

    // [8] Tabs
    function activateTab(event) {
        const tabName = event.currentTarget.dataset.tab;
        document.querySelectorAll('.gt-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.gt-tab-content').forEach(content => content.classList.remove('active'));
        event.currentTarget.classList.add('active');
        document.getElementById(`gt-tab-${tabName}`).classList.add('active');

        if (tabName === 'code') {
            updateCodeView();
        }
    }

    function updateCodeView() {
        const codeElement = document.querySelector('#gt-tab-code code');
        if (codeElement) {
            codeElement.textContent = generateCssString();
        }
    }

    function copyGeneratedCode() {
        const code = generateCssString();
        navigator.clipboard.writeText(code).then(() => alert('Code copied to clipboard!'));
    }

    // [3] Inspect Element
    function toggleInspectMode() {
        state.isInspectMode = !state.isInspectMode;
        document.querySelector('.gt-inspect-btn').classList.toggle('active', state.isInspectMode);
        
        if (state.isInspectMode) {
            // Create highlighter if it doesn't exist
            if (!document.getElementById('gt-inspector-highlight')) {
                const highlighter = document.createElement('div');
                highlighter.id = 'gt-inspector-highlight';
                document.body.appendChild(highlighter);
            }
            document.addEventListener('mouseover', inspectorMouseOver);
            document.addEventListener('click', inspectorClick, true); // Use capturing
        } else {
            const highlighter = document.getElementById('gt-inspector-highlight');
            if (highlighter) highlighter.style.display = 'none';
            document.removeEventListener('mouseover', inspectorMouseOver);
            document.removeEventListener('click', inspectorClick, true);
        }
    }

    function inspectorMouseOver(e) {
        const highlighter = document.getElementById('gt-inspector-highlight');
        // Don't highlight the panel or the highlighter itself
        if (e.target.closest('#gt-editor-panel') || e.target.id === 'gt-inspector-highlight') {
            highlighter.style.display = 'none';
            return;
        }
        highlighter.style.display = 'block';
        const rect = e.target.getBoundingClientRect();
        highlighter.style.top = `${rect.top + window.scrollY}px`;
        highlighter.style.left = `${rect.left + window.scrollX}px`;
        highlighter.style.width = `${rect.width}px`;
        highlighter.style.height = `${rect.height}px`;
    }

    function inspectorClick(e) {
        if (!state.isInspectMode || e.target.closest('#gt-editor-panel')) return;
        e.preventDefault();
        e.stopPropagation();

        filterRulesForElement(e.target);
        toggleInspectMode(); // Exit inspect mode after selection
    }

    function filterRulesForElement(element) {
        const rulesContainer = document.querySelector('.gt-rules-container');
        rulesContainer.querySelectorAll('.gt-rule-block').forEach(block => {
            const selector = block.dataset.selector;
            try {
                if (element.matches(selector)) {
                    block.style.display = '';
                } else {
                    block.style.display = 'none';
                }
            } catch (err) {
                block.style.display = 'none'; // Hide invalid selectors
            }
        });
        document.getElementById('gt-clear-filter-btn').style.display = 'block';
        // Switch to editor tab if not already active
        document.querySelector('.gt-tab-btn[data-tab="editor"]').click();
    }

    function clearInspectorFilter() {
        document.querySelectorAll('.gt-rules-container .gt-rule-block').forEach(block => {
            block.style.display = '';
        });
        document.getElementById('gt-clear-filter-btn').style.display = 'none';
    }


    // --- Core Logic & Helpers (some modified) ---

    function getThemeVariables() { /* Unchanged */
        return new Promise(async (resolve) => {
             try {
                const themeURL = browser.runtime.getURL("themes/theme.css");
                const response = await fetch(themeURL);
                if (!response.ok) resolve([]);
                const text = await response.text();
                const variables = text.match(/--[\w-]+/g) || [];
                resolve([...new Set(variables)]);
            } catch (error) {
                console.error("Global Themer: Could not fetch theme.css", error);
                resolve([]);
            }
        });
    }

    function processStylesheets(themeVariables) {
        const container = document.querySelector('.gt-rules-container');
        if (!container) return;
        for (const stylesheet of document.styleSheets) {
            try {
                for (const rule of stylesheet.cssRules) {
                    if (rule.type === CSSRule.STYLE_RULE && rule.style.length > 0) {
                        container.appendChild(createRuleUI(rule, themeVariables));
                    }
                }
            } catch (e) { /* Skip cross-origin sheets */ }
        }
    }

    function pushPageContent(isOpening) {
        const htmlElement = document.documentElement;
        const panelWidth = document.getElementById('gt-editor-panel')?.offsetWidth + 'px' || '350px';
        
        // Clear previous styles first
        htmlElement.style.marginRight = '';
        htmlElement.style.marginLeft = '';

        if (isOpening) {
            htmlElement.style.transition = `margin-${state.panelSide} 0.2s ease-in-out`;
            if (state.panelSide === 'right') {
                htmlElement.style.marginRight = panelWidth;
            } else {
                htmlElement.style.marginLeft = panelWidth;
            }
        }
    }

    function cleanup() {
        document.getElementById('gt-editor-panel')?.remove();
        document.getElementById('gt-inspector-highlight')?.remove();
        pushPageContent(false);
        window.removeEventListener('beforeunload', cleanup);
    }
    
    function generateCssString() {
        const rulesMap = new Map();
        document.querySelectorAll('.gt-rule-block').forEach(block => {
            const selector = block.dataset.selector;
            block.querySelectorAll('select').forEach(select => {
                if (select.value.startsWith('var(')) {
                    if (!rulesMap.has(selector)) rulesMap.set(selector, []);
                    rulesMap.get(selector).push(`  ${select.dataset.propertyName}: ${select.value};`);
                }
            });
        });
        if (rulesMap.size === 0) return "/* No variables assigned. */";
        let cssString = '/* Generated by Global Themer */\n\n';
        rulesMap.forEach((properties, selector) => {
            cssString += `${selector} {\n${properties.join('\n')}\n}\n\n`;
        });
        return cssString;
    }

    function toggleHighlight(selector, show) { /* Unchanged */
        try { document.querySelectorAll(selector).forEach(el => el.classList.toggle('gt-highlight-element', show)); } catch (e) {}
    }

    init();
})();

