/* ==========================================================================
   Calq – Core Application Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- Splash Loader Management ---
    const appLoader = document.getElementById('app-loader');
    
    // Simulate application startup loading
    setTimeout(() => {
        if (appLoader) {
            appLoader.classList.add('fade-out');
            
            // Cleanup DOM after fade animation is complete
            setTimeout(() => {
                appLoader.remove();
            }, 500); // Matches CSS transition duration
        }
    }, 1200);

    // --- DOM Elements ---
    const displayCurrent = document.getElementById('display-current');
    const displayHistoryPreview = document.getElementById('display-history-preview');
    const copyBtn = document.getElementById('copy-btn');
    const calculatorCard = document.getElementById('calculator-card');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    
    // History Panel Elements
    const historyToggleBtn = document.getElementById('history-toggle-btn');
    const historyPanel = document.getElementById('history-panel');
    const closeHistoryBtn = document.getElementById('close-history-btn');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const historyList = document.getElementById('history-list');
    const historyEmpty = document.getElementById('history-empty');
    const overlay = document.getElementById('overlay');
    
    const keypad = document.querySelector('.keypad');

    // --- State Variables ---
    let currentValue = '0';      // The number currently being entered
    let expression = '';        // The historical expression (e.g. "12 + 5 * ")
    let shouldReset = false;     // True if a calculation was just completed
    const HISTORY_KEY = 'calq_history';
    let history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];

    // --- Initialise App ---
    initTheme();
    renderHistory();
    updateDisplay();

    // --- Theme Management ---
    function initTheme() {
        const savedTheme = localStorage.getItem('calq_theme') || 'dark';
        if (savedTheme === 'light') {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
        }
    }

    themeToggleBtn.addEventListener('click', (e) => {
        createRipple(e);
        if (document.body.classList.contains('dark-theme')) {
            document.body.classList.replace('dark-theme', 'light-theme');
            localStorage.setItem('calq_theme', 'light');
        } else {
            document.body.classList.replace('light-theme', 'dark-theme');
            localStorage.setItem('calq_theme', 'dark');
        }
    });

    // --- Core Display Functions ---
    function updateDisplay() {
        // Render current value or equation progress
        if (currentValue === '' && expression === '') {
            displayCurrent.textContent = '0';
        } else if (currentValue === '' && expression !== '') {
            // Trim trailing space and operator for aesthetic display representation
            const displayStr = expression.trim();
            displayCurrent.textContent = displayStr;
        } else {
            displayCurrent.textContent = currentValue;
        }

        // Render previous equation preview
        if (expression !== '') {
            displayHistoryPreview.textContent = expression;
        } else if (!shouldReset) {
            displayHistoryPreview.innerHTML = '&nbsp;';
        }
        
        adjustFontSize();
    }

    function adjustFontSize() {
        const length = displayCurrent.textContent.length;
        if (length > 16) {
            displayCurrent.style.fontSize = '1.35rem';
        } else if (length > 12) {
            displayCurrent.style.fontSize = '1.75rem';
        } else if (length > 8) {
            displayCurrent.style.fontSize = '2.2rem';
        } else {
            displayCurrent.style.fontSize = '2.6rem';
        }
    }

    function triggerShake() {
        calculatorCard.classList.add('shake');
        // Vibrate mobile device if API is supported
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }
        setTimeout(() => {
            calculatorCard.classList.remove('shake');
        }, 400);
    }

    // --- Calculation Engine & Helpers ---
    function formatResult(num) {
        if (isNaN(num)) return 'Format Error';
        if (!isFinite(num)) return 'Cannot divide by zero';

        let resultStr = num.toString();

        // Fix JS floating point errors (e.g. 0.1 + 0.2 = 0.30000000000000004)
        if (resultStr.includes('.') && resultStr.length > 12) {
            // Round to 10 decimal places to remove floating noise
            const rounded = Number(num.toFixed(10));
            resultStr = rounded.toString();
        }

        // If it's still extremely long, format in scientific notation to prevent display breaking
        if (resultStr.length > 14) {
            resultStr = num.toExponential(7);
        }

        return resultStr;
    }

    function evaluateExpression() {
        // Construct full math statement
        let fullExpr = expression + currentValue;
        
        // Strip spaces
        let cleaned = fullExpr.trim();
        if (cleaned === '') return;

        // Strip any trailing operator before evaluating (e.g. "5 + " becomes "5")
        cleaned = cleaned.replace(/[\+\-\*\/÷×\s]+$/, '');
        if (cleaned === '') return;

        // Perform visual mapping for mathematical evaluation
        let evalStr = cleaned.replace(/×/g, '*').replace(/÷/g, '/');

        // Check for division by zero pattern under the hood
        // E.g. /0 or /0.00... followed by anything that isn't a non-zero digit
        if (/\/0+(\.0+)?(?![1-9])/.test(evalStr)) {
            triggerShake();
            displayCurrent.textContent = 'Cannot divide by zero';
            currentValue = '0';
            expression = '';
            shouldReset = true;
            return;
        }

        // Safe evaluation sandbox using Function constructor
        try {
            // Restrict characters to numbers, operators, decimals, parentheses, and spaces
            if (!/^[0-9.+\-*/()\s]+$/.test(evalStr)) {
                throw new Error('Unsafe expression');
            }

            const computation = new Function(`return (${evalStr})`)();
            const formatted = formatResult(computation);

            if (formatted === 'Cannot divide by zero' || formatted === 'Format Error') {
                triggerShake();
                displayCurrent.textContent = formatted;
                currentValue = '0';
                expression = '';
                shouldReset = true;
                return;
            }

            // Save visual history
            addHistoryItem(cleaned, formatted);

            // Trigger smooth display scale/fade transition
            displayCurrent.classList.add('animating');
            displayCurrent.addEventListener('animationend', () => {
                displayCurrent.classList.remove('animating');
            }, { once: true });

            // Update state
            displayHistoryPreview.textContent = cleaned + ' =';
            currentValue = formatted;
            expression = '';
            shouldReset = true;
            updateDisplay();
        } catch (error) {
            triggerShake();
            displayCurrent.textContent = 'Format Error';
            currentValue = '0';
            expression = '';
            shouldReset = true;
        }
    }

    // --- Keypad Action Routing ---
    keypad.addEventListener('click', (e) => {
        const button = e.target.closest('.btn');
        if (!button) return;

        createRipple(e);
        const key = button.getAttribute('data-key');
        handleInput(key);
    });

    function handleInput(key) {
        if (!key) return;

        // If it's a number key
        if (!isNaN(key) || key === '.') {
            handleNumber(key);
        }
        // If it's an operator
        else if (['+', '-', '*', '/'].includes(key)) {
            handleOperator(key);
        }
        // Special actions
        else {
            switch (key) {
                case 'Escape': // AC
                    clearAll();
                    break;
                case 'Backspace': // DEL
                    deleteLast();
                    break;
                case '%':
                    applyPercent();
                    break;
                case 'negate': // ±
                    toggleSign();
                    break;
                case 'Enter': // =
                    evaluateExpression();
                    break;
            }
        }
        
        // Don't update display if an error was just shown
        const currentText = displayCurrent.textContent;
        if (currentText !== 'Cannot divide by zero' && currentText !== 'Format Error') {
            updateDisplay();
        }
    }

    function handleNumber(num) {
        if (shouldReset) {
            currentValue = num === '.' ? '0.' : num;
            shouldReset = false;
            updateDisplay();
            return;
        }

        if (num === '.') {
            // Prevent multiple decimals in the current value segment
            if (currentValue.includes('.')) return;
            if (currentValue === '' || currentValue === '-') {
                currentValue += '0.';
                return;
            }
        }

        // Prevent multiple starting zeros
        if (currentValue === '0' && num !== '.') {
            currentValue = num;
            return;
        }

        currentValue += num;
    }

    function handleOperator(op) {
        // Translate operator key to elegant symbols for display
        let opSymbol = op;
        if (op === '*') opSymbol = '×';
        if (op === '/') opSymbol = '÷';

        // Allow entering negative values first if nothing exists
        if (currentValue === '' && expression === '') {
            if (op === '-') {
                currentValue = '-';
            }
            return;
        }

        // If a operator was pressed after evaluation, use result as starting point
        if (shouldReset) {
            shouldReset = false;
        }

        // Replace operator if user changes mind
        if (currentValue === '' || currentValue === '-') {
            if (expression !== '') {
                // Regex matches trailing operator and space
                expression = expression.trim().replace(/[\+\-\*\/÷×]$/, opSymbol) + ' ';
            } else if (op === '-') {
                currentValue = '-';
            }
            return;
        }

        // Standard operator insertion
        expression += currentValue + ' ' + opSymbol + ' ';
        currentValue = '';
    }

    function applyPercent() {
        if (currentValue === '' || currentValue === '-') return;
        const val = parseFloat(currentValue);
        currentValue = formatResult(val / 100);
    }

    // Toggles negative/positive sign of active input
    function toggleSign() {
        if (currentValue === '' || currentValue === '-') {
            // Toggle last result sign if it was an evaluation
            if (shouldReset && currentValue !== '0') {
                currentValue = currentValue.startsWith('-') ? currentValue.substring(1) : '-' + currentValue;
                shouldReset = false;
            } else {
                currentValue = currentValue === '-' ? '' : '-';
            }
            return;
        }
        
        if (currentValue === '0') return;

        if (currentValue.startsWith('-')) {
            currentValue = currentValue.substring(1);
        } else {
            currentValue = '-' + currentValue;
        }
    }

    function deleteLast() {
        if (shouldReset) {
            clearAll();
            return;
        }

        if (currentValue !== '') {
            currentValue = currentValue.slice(0, -1);
            if (currentValue === '-' || currentValue === '') {
                currentValue = '';
            }
        } else if (expression !== '') {
            // Premium feature: Pull previous operator and values from historical expression
            let trimmed = expression.trim();
            // Split into tokens
            let tokens = trimmed.split(' ');
            if (tokens.length > 0) {
                // Remove the trailing operator
                tokens.pop();
                if (tokens.length > 0) {
                    // Pull last number into current value and rebuild remaining expression
                    currentValue = tokens.pop();
                    expression = tokens.length > 0 ? tokens.join(' ') + ' ' : '';
                } else {
                    expression = '';
                }
            }
        }
    }

    function clearAll() {
        currentValue = '0';
        expression = '';
        shouldReset = false;
        displayHistoryPreview.innerHTML = '&nbsp;';
        displayCurrent.textContent = '0';
        updateDisplay();
    }

    // --- Clipboard Copy Logic ---
    copyBtn.addEventListener('click', async () => {
        const textToCopy = displayCurrent.textContent;
        if (textToCopy === '0' || textToCopy === 'Format Error' || textToCopy === 'Cannot divide by zero') return;

        try {
            await navigator.clipboard.writeText(textToCopy);
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    });

    // --- History Drawer Management ---
    function openHistory() {
        historyPanel.classList.add('open');
        overlay.classList.add('active');
        renderHistory();
        
        // accessibility focus management
        closeHistoryBtn.focus();
    }

    function closeHistory() {
        historyPanel.classList.remove('open');
        overlay.classList.remove('active');
        
        // Return focus to trigger button
        historyToggleBtn.focus();
    }

    historyToggleBtn.addEventListener('click', (e) => {
        createRipple(e);
        if (historyPanel.classList.contains('open')) {
            closeHistory();
        } else {
            openHistory();
        }
    });

    closeHistoryBtn.addEventListener('click', (e) => {
        createRipple(e);
        closeHistory();
    });

    overlay.addEventListener('click', closeHistory);

    // Escape closes drawer
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && historyPanel.classList.contains('open')) {
            closeHistory();
        }
    });

    clearHistoryBtn.addEventListener('click', (e) => {
        createRipple(e);
        history = [];
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
    });

    function addHistoryItem(expr, res) {
        // Prevent duplicate consecutive history records
        if (history.length > 0 && history[0].expr === expr && history[0].res === res) return;

        history.unshift({ expr, res });
        if (history.length > 30) {
            history.pop(); // Cap history to 30 items
        }
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }

    function renderHistory() {
        historyList.innerHTML = '';
        if (history.length === 0) {
            historyEmpty.classList.remove('hidden');
            return;
        }
        historyEmpty.classList.add('hidden');

        history.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'history-item';
            li.setAttribute('tabindex', '0');
            li.setAttribute('role', 'button');
            li.setAttribute('aria-label', `Recall calculation: ${item.expr} equals ${item.res}`);

            li.innerHTML = `
                <div class="history-expr">${item.expr}</div>
                <div class="history-result">${item.res}</div>
            `;

            // Create individual delete button
            const delBtn = document.createElement('button');
            delBtn.className = 'history-item-del-btn';
            delBtn.setAttribute('aria-label', 'Delete this calculation');
            delBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="12" height="12">
                    <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            `;

            // Click handler for delete button
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents loading the item back to calculator display
                deleteHistoryItem(index);
            });

            li.appendChild(delBtn);

            // Clicking retrieves calculation
            li.addEventListener('click', () => {
                loadHistoryItem(item);
            });

            li.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    loadHistoryItem(item);
                }
            });

            historyList.appendChild(li);
        });
    }

    function deleteHistoryItem(index) {
        history.splice(index, 1);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        renderHistory();
    }

    function loadHistoryItem(item) {
        currentValue = item.res;
        expression = '';
        displayHistoryPreview.textContent = item.expr + ' =';
        shouldReset = true;
        updateDisplay();
        closeHistory();
    }

    // --- Dynamic Click Ripple Generator ---
    function createRipple(event) {
        const target = event.currentTarget;
        if (!target) return;

        // Remove old ripples to prevent DOM accumulation
        const oldRipples = target.querySelectorAll('.ripple');
        oldRipples.forEach(r => r.remove());

        const circle = document.createElement('span');
        const diameter = Math.max(target.clientWidth, target.clientHeight);
        const radius = diameter / 2;

        const rect = target.getBoundingClientRect();
        // Support mouse clicks or centered defaults (e.g. keyboard triggers)
        const x = event.clientX ? (event.clientX - rect.left) : (target.clientWidth / 2);
        const y = event.clientY ? (event.clientY - rect.top) : (target.clientHeight / 2);

        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${x - radius}px`;
        circle.style.top = `${y - radius}px`;
        circle.classList.add('ripple');

        target.appendChild(circle);

        circle.addEventListener('animationend', () => {
            circle.remove();
        });
    }

    // --- Keyboard Event Mapping ---
    window.addEventListener('keydown', (event) => {
        let key = event.key;

        // Do not intercept hotkeys like Ctrl+R, Ctrl+Shift+I, etc.
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        // Map alternate key conventions
        if (key === 'c' || key === 'C') key = 'Escape';
        if (key === 'Delete') key = 'Backspace';
        if (key === '=') key = 'Enter';

        // Check if matching button exists
        const btn = document.querySelector(`.btn[data-key="${key}"]`);
        if (btn) {
            event.preventDefault(); // Block browser default shortcuts (e.g. "/" opening search)

            // Trigger click ripple centered on the button
            btn.classList.add('keyboard-active');
            handleInput(key);

            // Manual ripple simulation for keyboard
            const circle = document.createElement('span');
            const diameter = Math.max(btn.clientWidth, btn.clientHeight);
            const radius = diameter / 2;
            circle.style.width = circle.style.height = `${diameter}px`;
            circle.style.left = `${btn.clientWidth / 2 - radius}px`;
            circle.style.top = `${btn.clientHeight / 2 - radius}px`;
            circle.classList.add('ripple');
            btn.appendChild(circle);
            circle.addEventListener('animationend', () => circle.remove());

            setTimeout(() => {
                btn.classList.remove('keyboard-active');
            }, 120);
        }
    });
});
