// Main Application Logic
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Canvas Logic
    const circuitCanvas = new CircuitCanvas('circuitCanvas');

    // --- UI bindings ---

    // Board Size Controls
    const boardWidthInput = document.getElementById('boardWidth');
    const boardHeightInput = document.getElementById('boardHeight');
    const updateBoardBtn = document.getElementById('updateBoardBtn');

    updateBoardBtn.addEventListener('click', () => {
        const w = parseInt(boardWidthInput.value, 10);
        const h = parseInt(boardHeightInput.value, 10);
        if (w > 0 && h > 0) {
            circuitCanvas.resizeBoard(w, h);
        }
    });

    // Wire Color Palette Generation
    // Standard resistor color code + Tinned (Silver/Gray)
    const colors = [
        { name: 'Black', hex: '#000000' },
        { name: 'Brown', hex: '#8B4513' },
        { name: 'Red', hex: '#FF0000' },
        { name: 'Orange', hex: '#FFA500' },
        { name: 'Yellow', hex: '#FFFF00' },
        { name: 'Green', hex: '#008000' },
        { name: 'Blue', hex: '#0000FF' },
        { name: 'Purple', hex: '#800080' },
        { name: 'Gray', hex: '#808080' },
        { name: 'White', hex: '#FFFFFF' },
        { name: 'Tinned', hex: '#C0C0C0' } // Silver/Tinned wire
    ];

    const paletteContainer = document.getElementById('colorPalette');
    let selectedColorHex = colors[2].hex; // Default Red

    colors.forEach(col => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = col.hex;
        swatch.title = col.name;
        swatch.dataset.hex = col.hex;

        swatch.addEventListener('click', () => {
            // Remove active class from all
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            // Add to current
            swatch.classList.add('active');
            selectedColorHex = col.hex;
            circuitCanvas.setWireColor(selectedColorHex);
        });

        // Set default active
        if (col.name === 'Red') swatch.classList.add('active');

        paletteContainer.appendChild(swatch);
    });

    // Wire Type Toggle (Front/Back)
    const wireTypeRadios = document.getElementsByName('wireType');
    wireTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                circuitCanvas.setWireType(e.target.value);
            }
        });
    });

    // Component Actions
    document.getElementById('addComponentBtn').addEventListener('click', () => {
        const w = parseInt(document.getElementById('compWidth').value);
        const h = parseInt(document.getElementById('compHeight').value);
        const label = document.getElementById('compLabel').value || '';
        const pins = document.getElementById('compPins').value || '';
        if (w > 0 && h > 0) {
            circuitCanvas.addComponent(w, h, label, pins);
        }
    });

    const updateBtn = document.getElementById('updateComponentBtn');
    updateBtn.addEventListener('click', () => {
        const w = parseInt(document.getElementById('compWidth').value);
        const h = parseInt(document.getElementById('compHeight').value);
        const label = document.getElementById('compLabel').value || '';
        const pins = document.getElementById('compPins').value || ''; // Fixed: was using compLabel again

        if (w > 0 && h > 0) {
            circuitCanvas.updateSelectedComponent(w, h, label, pins);
        }
    });

    // Callback when a component is selected in canvas
    circuitCanvas.onSelectionChanged = (comp) => {
        if (comp) {
            document.getElementById('compWidth').value = comp.w;
            document.getElementById('compHeight').value = comp.h;
            document.getElementById('compLabel').value = comp.label || '';
            document.getElementById('compPins').value = (comp.pinLabels || []).join(',');
            updateBtn.disabled = false;
            updateBtn.innerText = `Update (${comp.label || 'Selected'})`;
        } else {
            updateBtn.disabled = true;
            updateBtn.innerText = 'Update';
        }
    };

    // Global Keydown for Undo/Redo
    document.addEventListener('keydown', (e) => {
        // Ignore if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            circuitCanvas.undo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            circuitCanvas.redo();
        }

        // Delete / Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            circuitCanvas.deleteSelected();
        }
    });

    document.getElementById('clearBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the entire board?')) {
            circuitCanvas.clearAll();
        }
    });

    // Save JSON
    document.getElementById('saveBtn').addEventListener('click', () => {
        const json = circuitCanvas.toJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'circuit.json';
        link.click();
    });

    // Load JSON
    const fileInput = document.getElementById('fileInput');
    document.getElementById('loadBtn').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const success = circuitCanvas.loadJSON(e.target.result);
            if (success) {
                // Update UI inputs to match loaded grid
                boardWidthInput.value = circuitCanvas.gridWidth;
                boardHeightInput.value = circuitCanvas.gridHeight;
                // Reset input value to allow reloading same file
                fileInput.value = '';
            } else {
                alert('Failed to load file.');
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'wiring_diagram.png';
        link.href = circuitCanvas.canvas.toDataURL();
        link.click();
    });

    // Initial setup
    circuitCanvas.resizeBoard(parseInt(boardWidthInput.value), parseInt(boardHeightInput.value));
    circuitCanvas.setWireColor(selectedColorHex);
});
