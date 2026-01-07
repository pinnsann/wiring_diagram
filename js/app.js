// Main Application Logic
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Canvas Logic
    const circuitCanvas = new CircuitCanvas('circuitCanvas');
    // Align view to center initially
    setTimeout(() => circuitCanvas.resetView(), 100);

    // --- UI bindings ---
    const boardWidthInput = document.getElementById('boardWidth');
    const boardHeightInput = document.getElementById('boardHeight');
    const updateBoardBtn = document.getElementById('updateBoardBtn');

    // Helper: Build YYYYMMDDhhmmss timestamp
    const getTimestamp = () => {
        const now = new Date();
        return now.getFullYear().toString() +
            (now.getMonth() + 1).toString().padStart(2, '0') +
            now.getDate().toString().padStart(2, '0') +
            now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0') +
            now.getSeconds().toString().padStart(2, '0');
    };

    updateBoardBtn.addEventListener('click', () => {
        const w = parseInt(boardWidthInput.value, 10);
        const h = parseInt(boardHeightInput.value, 10);
        if (w > 0 && h > 0) {
            circuitCanvas.resizeBoard(w, h);
        }
    });

    // Sidebar Toggle
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('closed');
        if (sidebar.classList.contains('closed')) {
            toggleBtn.innerText = '❯';
        } else {
            toggleBtn.innerText = '❮';
        }
        // Force redraw to handle canvas resize if flex changes
        setTimeout(() => circuitCanvas.updateCanvasSize(), 300);
    });

    document.getElementById('resetViewBtn').addEventListener('click', () => {
        circuitCanvas.resetView();
    });

    // Wire Color Palette - Standard Ribbon Code + Tinned
    const colors = [
        { name: 'Black', hex: '#000000', desc: 'GND / Code 0' },
        { name: 'Brown', hex: '#795548', desc: 'Code 1' },
        { name: 'Red', hex: '#ef4444', desc: 'VCC / Code 2' },
        { name: 'Orange', hex: '#f97316', desc: 'Code 3' },
        { name: 'Yellow', hex: '#eab308', desc: 'Code 4' },
        { name: 'Green', hex: '#22c55e', desc: 'Code 5' },
        { name: 'Blue', hex: '#3b82f6', desc: 'Code 6' },
        { name: 'Purple', hex: '#a855f7', desc: 'Code 7' },
        { name: 'Gray', hex: '#9ca3af', desc: 'Code 8' },
        { name: 'White', hex: '#ffffff', desc: 'Code 9' },
        { name: 'Tinned', hex: '#cbd5e1', desc: 'Silver / Jumper' }
    ];

    const paletteContainer = document.getElementById('colorPalette');
    let selectedColorHex = colors[2].hex; // Default Red

    colors.forEach(col => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = col.hex;

        // Tooltip
        swatch.title = `${col.name} - ${col.desc}`;

        swatch.dataset.hex = col.hex;

        swatch.addEventListener('click', () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            selectedColorHex = col.hex;
            circuitCanvas.setWireColor(selectedColorHex);
        });

        if (col.name === 'Red') swatch.classList.add('active');
        paletteContainer.appendChild(swatch);
    });

    const wireTypeRadios = document.getElementsByName('wireType');
    wireTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                circuitCanvas.setWireType(e.target.value);
            }
        });
    });

    // --- Pin Helper Logic ---
    const compPinsTop = document.getElementById('compPinsTop');
    const compPinsBottom = document.getElementById('compPinsBottom');

    // Focus Tracking for Helpers
    let lastFocusedInput = compPinsTop;
    [compPinsTop, compPinsBottom].forEach(el => {
        if (el) el.addEventListener('focus', () => lastFocusedInput = el);
    });

    function addPinTextTo(input, pinName) {
        if (!input) return;
        let current = input.value.trim();
        if (current.length > 0 && !current.endsWith(',')) {
            current += ',';
        }
        input.value = current + pinName;
        autoResize(input);
    }

    // Helper Generator - Unified for Sidebar and Library
    function initPinHelpers(commonId, gpioId, topId, bottomId) {
        const commonContainer = document.getElementById(commonId);
        const gpioContainer = document.getElementById(gpioId);
        const tInput = document.getElementById(topId);
        const bInput = document.getElementById(bottomId);
        if (!commonContainer || !gpioContainer) return;

        commonContainer.innerHTML = '';
        gpioContainer.innerHTML = '';

        let lastFocus = tInput;
        if (tInput) tInput.addEventListener('focus', () => lastFocus = tInput);
        if (bInput) bInput.addEventListener('focus', () => lastFocus = bInput);

        const commonPins = ['GND', 'VCC', '5V', '3.3V', 'VIN', 'SCL', 'SDA', 'RX', 'TX', '+', '-', 'A0', 'A1'];
        commonPins.forEach(p => {
            const btn = document.createElement('button');
            btn.innerText = p;
            btn.style.fontSize = '12px';
            btn.style.padding = '3px 8px';
            btn.style.cursor = 'pointer';
            btn.addEventListener('click', () => addPinTextTo(lastFocus, p));
            commonContainer.appendChild(btn);
        });

        for (let i = 1; i <= 50; i++) {
            const p = `G${i}`;
            const btn = document.createElement('button');
            btn.innerText = p;
            btn.style.fontSize = '12px';
            btn.style.padding = '3px 6px';
            btn.style.cursor = 'pointer';
            btn.addEventListener('click', () => addPinTextTo(lastFocus, p));
            gpioContainer.appendChild(btn);
        }
    }

    // Initialize Helpers
    initPinHelpers('commonPinBtns', 'gpioPinBtns', 'compPinsTop', 'compPinsBottom');
    initPinHelpers('libCommonPinBtns', 'libGpioPinBtns', 'libPinsTop', 'libPinsBottom');


    // --- Component Actions ---
    document.getElementById('addComponentBtn').addEventListener('click', () => {
        const w = parseInt(document.getElementById('compWidth').value);
        const h = parseInt(document.getElementById('compHeight').value);
        const label = document.getElementById('compLabel').value || '';
        const pinsTop = document.getElementById('compPinsTop').value || '';
        const pinsBottom = document.getElementById('compPinsBottom').value || '';
        const relative = document.getElementById('renderRelInput')?.checked || false;
        const rotate = document.getElementById('renderRotInput')?.checked || false;
        const isBoard = document.getElementById('renderBoardInput')?.checked || false;

        if (w > 0 && h > 0) {
            circuitCanvas.addComponent(w, h, label, pinsTop, pinsBottom, relative, rotate, isBoard);
        }
    });

    const updateBtn = document.getElementById('updateComponentBtn');
    updateBtn.addEventListener('click', () => {
        const w = parseInt(document.getElementById('compWidth').value);
        const h = parseInt(document.getElementById('compHeight').value);
        const label = document.getElementById('compLabel').value || '';
        const pinsTop = document.getElementById('compPinsTop').value || '';
        const pinsBottom = document.getElementById('compPinsBottom').value || '';
        const relative = document.getElementById('renderRelInput')?.checked || false;
        const rotate = document.getElementById('renderRotInput')?.checked || false;
        const isBoard = document.getElementById('renderBoardInput')?.checked || false;

        if (w > 0 && h > 0) {
            circuitCanvas.updateSelectedComponent(w, h, label, pinsTop, pinsBottom, relative, rotate, isBoard);
        }
    });



    // Swap Pins Logic
    const swapPins = (topId, bottomId) => {
        const t = document.getElementById(topId);
        const b = document.getElementById(bottomId);
        if (t && b) {
            const temp = t.value;
            t.value = b.value;
            b.value = temp;
            // Immediate resize after swap
            autoResize(t);
            autoResize(b);
        }
    };
    document.getElementById('swapCompPinsBtn')?.addEventListener('click', () => swapPins('compPinsTop', 'compPinsBottom'));
    document.getElementById('swapLibPinsBtn')?.addEventListener('click', () => swapPins('libPinsTop', 'libPinsBottom'));

    // Auto-Resize Textarea Logic
    const autoResize = (el) => {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight + 2) + 'px';
    };
    const setupAutoResize = (ids) => {
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.overflowY = 'hidden';
                ['input', 'focus', 'change', 'paste', 'cut'].forEach(evt => {
                    el.addEventListener(evt, () => autoResize(el));
                });
                // Initial check
                setTimeout(() => autoResize(el), 100);
            }
        });
    };
    setupAutoResize(['compPinsTop', 'compPinsBottom', 'libPinsTop', 'libPinsBottom']);

    // Callback when a component is selected in canvas
    circuitCanvas.onSelectionChanged = (comp) => {
        if (comp) {
            document.getElementById('compWidth').value = comp.w;
            document.getElementById('compHeight').value = comp.h;
            document.getElementById('compLabel').value = comp.label || '';

            // Update textareas
            const tTop = document.getElementById('compPinsTop');
            const tBot = document.getElementById('compPinsBottom');
            tTop.value = (comp.pinsTop || []).join(',');
            tBot.value = (comp.pinsBottom || []).join(',');
            autoResize(tTop);
            autoResize(tBot);

            // Checkboxes
            const cbRel = document.getElementById('renderRelInput');
            if (cbRel) cbRel.checked = !!comp.relative;
            const cbRot = document.getElementById('renderRotInput');
            if (cbRot) cbRot.checked = !!comp.rotate;
            const cbBoard = document.getElementById('renderBoardInput');
            if (cbBoard) cbBoard.checked = !!comp.isBoard;

            updateUIForBoardState(!!comp.isBoard, 'compPinsTop', 'compPinsBottom');

            updateBtn.disabled = false;
            updateBtn.innerText = `Update (${comp.label || 'Selected'})`;
        } else {
            updateBtn.disabled = true;
            updateBtn.innerText = 'Update';
        }
    };

    // Immediate Update on Checkbox Toggle
    document.getElementById('renderRelInput')?.addEventListener('change', () => updateBtn.click());
    document.getElementById('renderRotInput')?.addEventListener('change', () => updateBtn.click());
    document.getElementById('renderBoardInput')?.addEventListener('change', (e) => {
        updateUIForBoardState(e.target.checked, 'compPinsTop', 'compPinsBottom');
        updateBtn.click();
    });

    // Global Keydown
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); circuitCanvas.undo(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); circuitCanvas.redo(); }
        if (e.key === 'Delete' || e.key === 'Backspace') { circuitCanvas.deleteSelected(); }
    });

    // Custom Spin Button Logic
    document.querySelectorAll('.spin-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const wrapper = btn.closest('.spin-wrapper');
            const input = wrapper.querySelector('input');
            if (!input) return;

            const isPlus = btn.classList.contains('spin-plus');
            const step = parseInt(input.step) || 1;
            const min = parseInt(input.min) || 0;
            const max = parseInt(input.max) || 999;
            let val = parseInt(input.value) || min;

            if (isPlus) val += step;
            else val -= step;

            if (val < min) val = min;
            if (val > max) val = max;

            input.value = val;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });

    document.getElementById('clearBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the entire board?')) {
            circuitCanvas.clearAll();
        }
    });

    // Save/Load Board
    document.getElementById('saveBtn').addEventListener('click', () => {
        const json = circuitCanvas.toJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `current_state${getTimestamp()}.json`;
        link.click();
    });
    const fileInput = document.getElementById('fileInput');
    document.getElementById('loadBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const success = circuitCanvas.loadJSON(e.target.result);
            if (success) {
                boardWidthInput.value = circuitCanvas.gridWidth;
                boardHeightInput.value = circuitCanvas.gridHeight;
                fileInput.value = '';
            } else { alert('Failed to load file.'); }
        };
        reader.readAsText(file);
    });

    // --- Import Library (Batch Add) ---
    const libInput = document.getElementById('libInput');
    document.getElementById('importLibBtn').addEventListener('click', () => libInput.click());

    // Function to add components from array
    function importComponentsToBoard(components) {
        if (!Array.isArray(components)) return false;
        let startX = 2;
        let startY = 2;
        components.forEach(c => {
            let w = c.w || 4;
            let h = c.h || 2;
            let label = c.label || '';
            let pinsTop = c.pinsTop ? c.pinsTop.join(',') : '';
            // Handle array or string for pinsBottom (legacy support)
            let pinsBottom = c.pinsBottom ? c.pinsBottom.join(',') : (c.pins || (c.pinLabels ? c.pinLabels.join(',') : ''));
            let relative = !!c.relative;
            let rotate = !!c.rotate;
            let isBoard = !!c.isBoard;

            circuitCanvas.addComponent(w, h, label, pinsTop, pinsBottom, relative, rotate, isBoard);

            const addedComp = circuitCanvas.components[circuitCanvas.components.length - 1];
            if (addedComp) {
                // Determine if row is full? For now just simple wrapping or cascading
                addedComp.x = startX;
                addedComp.y = startY;
                startX += (w + 2);
                if (startX + w > circuitCanvas.gridWidth) {
                    startX = 2;
                    startY += (h + 3);
                }
            }
        });
        circuitCanvas.draw();
        return true;
    }

    // New Export Lib Logic
    document.getElementById('exportLibBtn').addEventListener('click', () => {
        if (circuitCanvas.components.length === 0) {
            alert('No components to export.');
            return;
        }
        // Map board components to Library Format (clean properties)
        const libData = circuitCanvas.components.map(c => ({
            label: c.label || '',
            w: c.w,
            h: c.h,
            pinsTop: c.pinsTop || [],
            pinsBottom: c.pinsBottom || [],
            relative: !!c.relative,
            rotate: !!c.rotate,
            isBoard: !!c.isBoard
        }));

        const json = JSON.stringify(libData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `current_components${getTimestamp()}.json`;
        link.click();
    });

    // ... existing ...

    libInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const components = JSON.parse(e.target.result);
                if (importComponentsToBoard(components)) {
                    alert(`Imported ${components.length} components.`);
                } else {
                    alert('Invalid JSON.');
                }
            } catch (err) { console.error(err); alert('Failed to Library JSON.'); }
            libInput.value = '';
        };
        reader.readAsText(file);
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
        const dataUrl = circuitCanvas.exportCanvasAsImage();
        const link = document.createElement('a');
        link.download = `Circuit_picture${getTimestamp()}.png`;
        link.href = dataUrl;
        link.click();
    });

    // --- Library Editor Modal Logic ---
    const modal = document.getElementById('libModal');
    const openModalBtn = document.getElementById('openLibEditorBtn');
    const closeModalSpan = document.getElementsByClassName('close-modal')[0];
    const libTableBody = document.querySelector('#libTable tbody');

    let libraryList = [];
    // Format: { w, h, label, pinsTop: [], pinsBottom: [] }

    let selectedLibIndex = -1;

    openModalBtn.addEventListener('click', () => {
        modal.style.display = 'block';
        renderLibTable();
        // Trigger auto-resize once visible
        setTimeout(() => {
            autoResize(document.getElementById('libPinsTop'));
            autoResize(document.getElementById('libPinsBottom'));
        }, 50);
    });
    closeModalSpan.addEventListener('click', () => { modal.style.display = 'none'; });
    window.addEventListener('click', (e) => { if (e.target == modal) modal.style.display = 'none'; });

    function renderLibTable() {
        libTableBody.innerHTML = '';
        libraryList.forEach((item, index) => {
            const tr = document.createElement('tr');
            if (index === selectedLibIndex) tr.classList.add('selected');

            // Render safe strings
            const pT = Array.isArray(item.pinsTop) ? item.pinsTop.join(',') : (item.pinsTop || '');
            const pB = Array.isArray(item.pinsBottom) ? item.pinsBottom.join(',') : (item.pinsBottom || (item.pins || ''));

            // Consolidate Config: Rel, Rot, Brd
            const flags = [];
            if (item.relative) flags.push('Rel');
            if (item.rotate) flags.push('Rot');
            if (item.isBoard) flags.push('Brd');
            const configText = flags.join(' ') || '-';

            tr.innerHTML = `
                <td>${item.label}</td>
                <td>${item.w} x ${item.h}</td>
                <td style="font-size:10px;">T: ${pT}<br>B: ${pB}</td>
                <td style="text-align:center; font-size:11px; color:#aaa;">${configText}</td>
            `;

            tr.onclick = () => selectLibItem(index);
            libTableBody.appendChild(tr);
        });
    }

    const updateUIForBoardState = (isBoard, topId, botId) => {
        const top = document.getElementById(topId);
        const bot = document.getElementById(botId);
        if (top) top.disabled = isBoard;
        if (bot) bot.disabled = isBoard;
    };

    function selectLibItem(index) {
        selectedLibIndex = index;
        const item = libraryList[index];
        document.getElementById('libLabel').value = item.label;
        document.getElementById('libW').value = item.w;
        document.getElementById('libH').value = item.h;

        const pT = Array.isArray(item.pinsTop) ? item.pinsTop.join(',') : (item.pinsTop || '');
        const pB = Array.isArray(item.pinsBottom) ? item.pinsBottom.join(',') : (item.pinsBottom || (item.pins || ''));

        const tTop = document.getElementById('libPinsTop');
        const tBot = document.getElementById('libPinsBottom');
        tTop.value = pT;
        tBot.value = pB;
        autoResize(tTop);
        autoResize(tBot);

        // Load Settings
        const cbRel = document.getElementById('libRenderRel');
        const cbRot = document.getElementById('libRenderRot');
        const cbBoard = document.getElementById('libRenderBoard');
        if (cbRel) cbRel.checked = !!item.relative;
        if (cbRot) cbRot.checked = !!item.rotate;
        if (cbBoard) cbBoard.checked = !!item.isBoard;

        updateUIForBoardState(!!item.isBoard, 'libPinsTop', 'libPinsBottom');

        document.getElementById('libUpdateBtn').disabled = false;
        document.getElementById('libDeleteBtn').disabled = false;
        renderLibTable();
    }

    function deleteLibItem(index) {
        libraryList.splice(index, 1);
        if (selectedLibIndex === index) {
            selectedLibIndex = -1;
            document.getElementById('libUpdateBtn').disabled = true;
            document.getElementById('libDeleteBtn').disabled = true;
        } else if (selectedLibIndex > index) {
            selectedLibIndex--;
        }
        renderLibTable();
    }

    document.getElementById('libAddBtn').addEventListener('click', () => {
        const w = parseInt(document.getElementById('libW').value);
        const h = parseInt(document.getElementById('libH').value);
        const label = document.getElementById('libLabel').value || '';
        const pinsTopStr = document.getElementById('libPinsTop').value || '';
        const pinsBottomStr = document.getElementById('libPinsBottom').value || '';
        const relative = document.getElementById('libRenderRel').checked;
        const rotate = document.getElementById('libRenderRot').checked;
        const isBoard = document.getElementById('libRenderBoard').checked;

        if (w > 0 && h > 0) {
            libraryList.push({
                w, h, label,
                pinsTop: pinsTopStr.split(',').map(s => s.trim()),
                pinsBottom: pinsBottomStr.split(',').map(s => s.trim()),
                relative, rotate, isBoard
            });
            renderLibTable();
        }
    });

    document.getElementById('libUpdateBtn').addEventListener('click', () => {
        if (selectedLibIndex < 0) return;
        const w = parseInt(document.getElementById('libW').value);
        const h = parseInt(document.getElementById('libH').value);
        const label = document.getElementById('libLabel').value || '';
        const pinsTopStr = document.getElementById('libPinsTop').value || '';
        const pinsBottomStr = document.getElementById('libPinsBottom').value || '';
        const relative = document.getElementById('libRenderRel').checked;
        const rotate = document.getElementById('libRenderRot').checked;
        const isBoard = document.getElementById('libRenderBoard').checked;

        libraryList[selectedLibIndex] = {
            w, h, label,
            pinsTop: pinsTopStr.split(',').map(s => s.trim()),
            pinsBottom: pinsBottomStr.split(',').map(s => s.trim()),
            relative, rotate, isBoard
        };
        renderLibTable();
    });

    document.getElementById('libDeleteBtn').addEventListener('click', () => {
        if (selectedLibIndex >= 0) {
            if (confirm('Delete this component from library?')) {
                deleteLibItem(selectedLibIndex);
            }
        }
    });

    // Live behavior for switches in Library
    document.getElementById('libRenderBoard')?.addEventListener('change', (e) => {
        updateUIForBoardState(e.target.checked, 'libPinsTop', 'libPinsBottom');
    });

    // Editor I/O
    document.getElementById('libSaveBtn').addEventListener('click', () => {
        const json = JSON.stringify(libraryList, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `edited_components${getTimestamp()}.json`;
        link.click();
    });

    document.getElementById('libImportToBoardBtn').addEventListener('click', () => {
        if (libraryList.length === 0) { alert('List is empty'); return; }
        if (importComponentsToBoard(libraryList)) {
            modal.style.display = 'none';
        }
    });

    document.getElementById('libLoadBtn').addEventListener('click', () => {
        const tempInput = document.createElement('input');
        tempInput.type = 'file';
        tempInput.accept = '.json';
        tempInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (Array.isArray(data)) {
                        libraryList = data;
                        selectedLibIndex = -1;
                        document.getElementById('libUpdateBtn').disabled = true;
                        renderLibTable();
                    } else { alert('Invalid Format'); }
                } catch (err) { alert('Error parsing'); }
            };
            reader.readAsText(file);
        };
        tempInput.click();
    });

    // Initial setup
    circuitCanvas.resizeBoard(parseInt(boardWidthInput.value), parseInt(boardHeightInput.value));
    circuitCanvas.setWireColor(selectedColorHex);
});
