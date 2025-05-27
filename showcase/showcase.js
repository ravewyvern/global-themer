        document.addEventListener('DOMContentLoaded', () => {
            const tooltip = document.getElementById('variable-tooltip');
            if (!tooltip) {
                console.error("Tooltip element not found!");
                return;
            }

            // --- Tooltip Logic ---
            document.querySelectorAll('[data-var-info], .show-var-on-hover').forEach(el => {
                el.addEventListener('mousemove', (e) => {
                    let varInfo = el.getAttribute('data-var-info');
                    if (!varInfo && el.classList.contains('show-var-on-hover')) {
                        let parentWithInfo = el.closest('[data-var-info]');
                        if (parentWithInfo) {
                            varInfo = parentWithInfo.getAttribute('data-var-info');
                        }
                    }
                    
                    if (varInfo) {
                        const formattedVarInfo = varInfo.replace(/;\s*/g, '\n').trim();
                        tooltip.textContent = formattedVarInfo;
                        tooltip.style.left = (e.pageX + 15) + 'px';
                        tooltip.style.top = (e.pageY + 10) + 'px';
                        tooltip.style.opacity = '1';
                        tooltip.style.display = 'block';
                    }
                });

                el.addEventListener('mouseleave', () => {
                    tooltip.style.opacity = '0';
                    setTimeout(() => {
                        if (tooltip.style.opacity === '0') { // Check again in case mouse re-entered quickly
                           tooltip.style.display = 'none';
                        }
                    }, 100); // Match transition duration
                });
            });

            // --- CSP-Compliant Event Handlers ---

            // Outline Input Example
            const outlineInput = document.getElementById('outline-input-example');
            if (outlineInput) {
                outlineInput.addEventListener('focus', function() {
                    this.style.outline = `var(--theme-outline-width, 2px) var(--theme-outline-style, solid) var(--theme-outline-color, #4f46e5)`;
                    this.style.outlineOffset = `var(--theme-outline-offset, 2px)`;
                });
                outlineInput.addEventListener('blur', function() {
                    this.style.outline = 'none';
                });
            }

            // Modal Example
            const modalTrigger = document.querySelector('.modal-example-trigger-btn');
            const modalBackdrop = document.getElementById('exampleModal');
            const modalCloseBtn = document.getElementById('exampleModalCloseBtn');
            const modalFooterCloseBtn = document.getElementById('exampleModalFooterCloseBtn');

            if (modalTrigger && modalBackdrop) {
                modalTrigger.addEventListener('click', () => {
                    modalBackdrop.style.display = 'flex';
                });
            }
            if (modalCloseBtn && modalBackdrop) {
                modalCloseBtn.addEventListener('click', () => {
                    modalBackdrop.style.display = 'none';
                });
            }
            if (modalFooterCloseBtn && modalBackdrop) {
                modalFooterCloseBtn.addEventListener('click', () => {
                    modalBackdrop.style.display = 'none';
                });
            }
            // Optional: Close modal if backdrop is clicked
            if (modalBackdrop) {
                modalBackdrop.addEventListener('click', function(event) {
                    if (event.target === this) { // Only if the backdrop itself was clicked
                        this.style.display = 'none';
                    }
                });
            }


            // Dropdown Item Example
            document.querySelectorAll('.dropdown-item-example').forEach(item => {
                item.addEventListener('mouseover', function() {
                    this.style.backgroundColor = 'var(--theme-dropdown-hover-bg)';
                });
                item.addEventListener('mouseout', function() {
                    this.style.backgroundColor = 'transparent';
                });
            });

            // Transition Example Div
            const transitionDiv = document.getElementById('transition-example-div');
            if (transitionDiv) {
                transitionDiv.addEventListener('mouseover', function() {
                    this.style.transform = 'scale(1.1)';
                });
                transitionDiv.addEventListener('mouseout', function() {
                    this.style.transform = 'scale(1)';
                });
            }
        });
