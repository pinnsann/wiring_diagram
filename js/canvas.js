class CircuitCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // Settings
        this.holeSize = 4;
        this.pitch = 20;
        this.boardOffset = { x: 100, y: 100 };
        this.margin = 300;

        // State
        this.gridWidth = 30;
        this.gridHeight = 20;
        this.wires = [];
        this.components = [];

        this.scale = 1.0;
        this.pan = { x: 0, y: 0 };

        // Undo/Redo History
        this.history = [];
        this.redoStack = [];
        this.maxHistory = 50;

        // Interaction
        this.isDrawing = false;
        this.isDraggingComponent = false;
        this.isPanning = false;

        this.draggedComponent = null;
        this.selectedElement = null;

        this.dragOffset = { x: 0, y: 0 };
        this.dragStartPos = null;
        this.panStart = { x: 0, y: 0 };

        this.startHole = null; // Grid coordinate {x,y}
        this.currentMousePos = null; // Raw pixel coordinates

        this.currentWireColor = '#ef4444'; // Modern Red default
        this.currentWireType = 'front';

        // Callback for UI
        this.onSelectionChanged = null;

        // Events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseout', () => {
            this.isDrawing = false;
            this.isDraggingComponent = false;
            this.isPanning = false;
            this.draggedComponent = null;
            this.draw();
        });
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

        this.canvas.setAttribute('tabindex', '0');
        this.canvas.style.outline = 'none';

        // Infinite Canvas Resizing
        window.addEventListener('resize', () => this.updateCanvasSize());
        // Initialize size immediately
        setTimeout(() => this.updateCanvasSize(), 0);
    }

    // --- History Management ---
    saveState() {
        const state = this.toJSON();
        this.history.push(state);
        if (this.history.length > this.maxHistory) this.history.shift();
        this.redoStack = [];
    }

    undo() {
        if (this.history.length === 0) return;
        this.redoStack.push(this.toJSON());
        this.loadJSON(this.history.pop(), false);
    }

    redo() {
        if (this.redoStack.length === 0) return;
        this.history.push(this.toJSON());
        this.loadJSON(this.redoStack.pop(), false);
    }

    // --- Actions ---
    deleteSelected() {
        if (!this.selectedElement) return;
        this.saveState();
        if (this.selectedElement.id) {
            this.components = this.components.filter(c => c !== this.selectedElement);
        } else {
            this.wires = this.wires.filter(w => w !== this.selectedElement);
        }
        this.selectElement(null);
        this.draw();
    }

    resizeBoard(w, h) {
        this.saveState();
        this.gridWidth = w;
        this.gridHeight = h;
        // Canvas size is now viewport-based, so just redraw
        this.draw();
    }

    updateCanvasSize() {
        const container = this.canvas.parentElement;
        if (container) {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
        }
        this.draw();
    }

    resetView() {
        this.scale = 1.0;
        // Center the board
        const boardPixelWidth = (this.gridWidth - 1) * this.pitch;
        const boardPixelHeight = (this.gridHeight - 1) * this.pitch;

        // Board center in World Coords (offset + half size)
        const boardCenterX = this.boardOffset.x + boardPixelWidth / 2;
        const boardCenterY = this.boardOffset.y + boardPixelHeight / 2;

        // Screen center
        const screenCenterX = this.canvas.width / 2;
        const screenCenterY = this.canvas.height / 2;

        // Pan = Screen - (World * Scale)
        this.pan.x = screenCenterX - boardCenterX * this.scale;
        this.pan.y = screenCenterY - boardCenterY * this.scale;

        this.draw();
    }

    setWireColor(color) { this.currentWireColor = color; }
    setWireType(type) { this.currentWireType = type; }

    clearAll() {
        this.saveState();
        this.wires = [];
        this.components = [];
        this.selectElement(null);
        this.draw();
    }

    // Updated: Supports split pins and Relative/Rotate/Board Rendering
    addComponent(w, h, label = '', pinsTopStr = '', pinsBottomStr = '', relative = false, rotate = false, isBoard = false) {
        this.saveState();
        const id = Date.now().toString();
        const x = 2;
        const y = 2;
        let pinsTop = [];
        let pinsBottom = [];
        if (pinsTopStr) pinsTop = pinsTopStr.split(',').map(s => s.trim());
        if (pinsBottomStr) pinsBottom = pinsBottomStr.split(',').map(s => s.trim());

        const newComp = { id, x, y, w, h, label, pinsTop, pinsBottom, relative: !!relative, rotate: !!rotate, isBoard: !!isBoard, rotation: rotate ? 90 : 0 };
        this.components.push(newComp);
        this.selectElement(newComp);
        this.draw();
    }

    updateSelectedComponent(w, h, label, pinsTopStr, pinsBottomStr, relative, rotate, isBoard) {
        if (!this.selectedElement || !this.selectedElement.id) return;
        this.saveState();
        this.selectedElement.w = w;
        this.selectedElement.h = h;
        this.selectedElement.label = label;

        if (pinsTopStr !== undefined) this.selectedElement.pinsTop = pinsTopStr.split(',').map(s => s.trim());
        if (pinsBottomStr !== undefined) this.selectedElement.pinsBottom = pinsBottomStr.split(',').map(s => s.trim());

        this.selectedElement.relative = !!relative;
        this.selectedElement.rotate = !!rotate;
        this.selectedElement.isBoard = !!isBoard;
        this.selectedElement.rotation = rotate ? 90 : 0;
        this.draw();
        if (this.onSelectionChanged) this.onSelectionChanged(this.selectedElement);
    }

    rotateSelectedComponent() {
        if (!this.selectedElement || !this.selectedElement.id) return;
        this.saveState();
        const c = this.selectedElement;

        // Swap W and H
        const temp = c.w;
        c.w = c.h;
        c.h = temp;

        // Toggle Rotation State (0 or 90)
        c.rotation = (c.rotation === 90) ? 0 : 90;

        this.draw();
        if (this.onSelectionChanged) this.onSelectionChanged(this.selectedElement);
    }

    selectElement(el) {
        this.selectedElement = el;
        this.draw();
        if (this.onSelectionChanged) {
            this.onSelectionChanged(el && el.id ? el : null);
        }
    }

    // --- Transforms & Logic ---
    getWorldFromScreen(rawX, rawY) { return { x: (rawX - this.pan.x) / this.scale, y: (rawY - this.pan.y) / this.scale }; }
    getGridFromWorld(wx, wy) { return { x: Math.round((wx - this.boardOffset.x) / this.pitch), y: Math.round((wy - this.boardOffset.y) / this.pitch) }; }
    getComponentAtGrid(gx, gy) { return this.components.find(c => gx >= c.x && gx < c.x + c.w && gy >= c.y && gy < c.y + c.h) || null; }

    isOffBoard(c) {
        const cRight = c.x + c.w; const cBottom = c.y + c.h;
        // Return true if COMPLETELY Disjoint from grid (Outside)
        return (cRight <= 0 || c.x >= this.gridWidth || cBottom <= 0 || c.y >= this.gridHeight);
    }
    shouldUseStripLayout(c) { return (c.relative === true); }
    getPinColor(label) {
        if (!label) return '#444';
        const l = label.toUpperCase();
        if (['GND', 'G', '-', 'VSS'].includes(l)) return '#222';
        if (['5V', 'VCC', 'VDD', '+', 'VIN'].includes(l)) return '#C62828';
        if (['3.3V', '3V3'].includes(l)) return '#EF6C00';
        if (['SDA', 'SCL'].includes(l)) return '#1565C0';
        if (['TX', 'RX'].includes(l)) return '#2E7D32';
        return '#555';
    }

    // Helper to identify if a grid coord is a Top or Bottom pin
    getPinTypeAt(c, gx, gy) {
        const lx = gx - c.x;
        const ly = gy - c.y;

        if (c.rotation === 90) {
            // Vertical: Left/Right Edge
            if (c.w < 1) return null;
            if (lx === c.w - 1 && ly >= 0 && ly < c.h) return { side: 'top', index: ly };
            if (lx === 0 && ly >= 0 && ly < c.h) return { side: 'bottom', index: ly };
        } else {
            // Horizontal: Top/Bottom Edge
            if (c.h < 1) return null;
            if (ly === 0 && lx >= 0 && lx < c.w) return { side: 'top', index: lx };
            if (ly === c.h - 1 && lx >= 0 && lx < c.w) return { side: 'bottom', index: lx };
        }
        return null;
    }

    getPixelsFromGrid(gx, gy) {
        const c = this.getComponentAtGrid(gx, gy);

        if (c && this.shouldUseStripLayout(c)) {
            // Strip Layout
            const baseX = c.x * this.pitch + this.boardOffset.x;
            const baseY = c.y * this.pitch + this.boardOffset.y;
            const visualLeft = baseX - this.pitch / 2 + 2;
            const visualTop = baseY - this.pitch / 2 + 2;
            const visualWidth = c.w * this.pitch - 4;
            const visualHeight = c.h * this.pitch - 4;
            const visualRight = visualLeft + visualWidth;
            const visualBottom = visualTop + visualHeight;

            const pinInfo = this.getPinTypeAt(c, gx, gy);

            if (pinInfo) {
                const { side, index } = pinInfo;
                // Pad sizing is visualization-only, strictly handled in draw.
                // Here we just need Center Coord.

                let activeIndices = [];
                const pinList = (side === 'top') ? c.pinsTop : c.pinsBottom;
                if (pinList) pinList.forEach((p, i) => { if (p && p.trim() !== '') activeIndices.push(i); });

                const visualPos = activeIndices.indexOf(index);
                const count = activeIndices.length;

                if (visualPos !== -1 && count > 0) {
                    // Determine Slot center
                    if (c.rotation === 90) {
                        // Vertical Formatting
                        const slotHeight = visualHeight / count;
                        const centerY = visualTop + (visualPos * slotHeight) + (slotHeight / 2);
                        const padSize = 18; // Standard Thickness matches drawPin
                        const centerX = (side === 'top')
                            ? visualRight - (padSize / 2) // Right Edge Flush
                            : visualLeft + (padSize / 2); // Left Edge Flush
                        return { x: centerX, y: centerY };
                    } else {
                        // Horizontal Formatting
                        const slotWidth = visualWidth / count;
                        const centerX = visualLeft + (visualPos * slotWidth) + (slotWidth / 2);
                        const padSize = 18; // Standard Thickness matches drawPin
                        const centerY = (side === 'top')
                            ? visualTop + (padSize / 2)     // Top Edge Flush
                            : visualBottom - (padSize / 2); // Bottom Edge Flush
                        return { x: centerX, y: centerY };
                    }
                }
            }
            // Fallback (e.g. inactive pin on strip)
            return { x: gx * this.pitch + this.boardOffset.x, y: gy * this.pitch + this.boardOffset.y };
        }
        return { x: gx * this.pitch + this.boardOffset.x, y: gy * this.pitch + this.boardOffset.y };
    }

    getComponentAt(worldX, worldY) {
        for (let i = this.components.length - 1; i >= 0; i--) {
            const c = this.components[i];
            const start = { x: c.x * this.pitch + this.boardOffset.x, y: c.y * this.pitch + this.boardOffset.y };
            if (worldX >= start.x - this.pitch / 2 && worldX <= start.x - this.pitch / 2 + c.w * this.pitch &&
                worldY >= start.y - this.pitch / 2 && worldY <= start.y - this.pitch / 2 + c.h * this.pitch) return c;
        }
        return null;
    }
    getWireAt(worldX, worldY) {
        const threshold = 10;
        for (let i = this.wires.length - 1; i >= 0; i--) {
            const w = this.wires[i]; const s = this.getPixelsFromGrid(w.x1, w.y1); const e = this.getPixelsFromGrid(w.x2, w.y2);
            if (this.pointToLineDistance(worldX, worldY, s.x, s.y, e.x, e.y) < threshold) return w;
        } return null;
    }
    pointToLineDistance(x, y, x1, y1, x2, y2) {
        const A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1;
        const dot = A * C + B * D, len_sq = C * C + D * D;
        let param = -1; if (len_sq !== 0) param = dot / len_sq;
        let xx, yy;
        if (param < 0) { xx = x1; yy = y1; } else if (param > 1) { xx = x2; yy = y2; } else { xx = x1 + param * C; yy = y1 + param * D; }
        const dx = x - xx, dy = y - yy; return Math.sqrt(dx * dx + dy * dy);
    }
    isPinAt(comp, gx, gy) {
        const pinType = this.getPinTypeAt(comp, gx, gy);
        if (!pinType) return false;
        const list = (pinType.side === 'top') ? comp.pinsTop : comp.pinsBottom;
        const label = (list && list[pinType.index]) ? list[pinType.index] : '';
        return (label && label.trim() !== '');
    }

    // --- Handlers ---
    handleWheel(e) { e.preventDefault(); const d = -e.deltaY * 0.001; this.scale = Math.max(0.5, Math.min(5, this.scale + d)); this.updateCanvasSize(); this.draw(); }
    handleMouseDown(e) {
        this.canvas.focus(); const rect = this.canvas.getBoundingClientRect();
        const rawX = e.clientX - rect.left; const rawY = e.clientY - rect.top;
        const wPos = this.getWorldFromScreen(rawX, rawY);

        const compHit = this.getComponentAt(wPos.x, wPos.y);
        if (compHit) {
            let best = null, minD = 8; // Tighter hit radius for pins (Prioritize Drag)
            for (let py = 0; py < compHit.h; py++) {
                for (let px = 0; px < compHit.w; px++) {
                    const gx = compHit.x + px, gy = compHit.y + py;
                    if (this.isPinAt(compHit, gx, gy)) {
                        const pos = this.getPixelsFromGrid(gx, gy);
                        const d = Math.sqrt(Math.pow(wPos.x - pos.x, 2) + Math.pow(wPos.y - pos.y, 2));
                        if (d < minD) { minD = d; best = { x: gx, y: gy }; }
                    }
                }
            }
            if (best) { this.isDrawing = true; this.startHole = best; this.currentMousePos = { x: rawX, y: rawY }; this.selectElement(null); this.draw(); return; }
            this.selectElement(compHit); this.isDraggingComponent = true; this.draggedComponent = compHit;
            this.dragStartPos = { x: compHit.x, y: compHit.y };
            const gRaw = this.getGridFromWorld(wPos.x, wPos.y);
            const gxRaw = (wPos.x - this.boardOffset.x) / this.pitch; const gyRaw = (wPos.y - this.boardOffset.y) / this.pitch;
            this.dragOffset = { x: gxRaw - compHit.x, y: gyRaw - compHit.y }; return;
        }

        const gridHit = this.getGridFromWorld(wPos.x, wPos.y);
        const holePos = this.getPixelsFromGrid(gridHit.x, gridHit.y);
        const hd = Math.sqrt(Math.pow(wPos.x - holePos.x, 2) + Math.pow(wPos.y - holePos.y, 2));

        if (hd < 14) { // Increased hole snapping radius
            // Check restrictions:
            // 1. Inside Board?
            const isInside = (gridHit.x >= 0 && gridHit.x < this.gridWidth && gridHit.y >= 0 && gridHit.y < this.gridHeight);

            // 2. On Existing Wire?
            const isOnWire = this.wires.some(w => {
                if ((w.x1 === gridHit.x && w.y1 === gridHit.y) || (w.x2 === gridHit.x && w.y2 === gridHit.y)) return true;
                return this.pointToLineDistance(gridHit.x, gridHit.y, w.x1, w.y1, w.x2, w.y2) < 0.2;
            });

            if (isInside || isOnWire) {
                this.isDrawing = true;
                this.startHole = gridHit;
                this.currentMousePos = { x: rawX, y: rawY };
                if (this.selectedElement) this.selectElement(null);
                this.draw();
                return;
            }
        }

        const hitWire = this.getWireAt(wPos.x, wPos.y);
        if (hitWire) { this.selectElement(hitWire); return; }

        if (this.selectedElement) this.selectElement(null);

        // Limit Panning to OUTSIDE the board
        const isInsideBoard = (gridHit.x >= 0 && gridHit.x < this.gridWidth && gridHit.y >= 0 && gridHit.y < this.gridHeight);
        if (isInsideBoard) {
            // Do nothing (disable panning inside board)
            return;
        }

        this.isPanning = true; this.panStart = { x: rawX, y: rawY }; this.panStartOffset = { x: this.pan.x, y: this.pan.y };
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect(); const rawX = e.clientX - rect.left; const rawY = e.clientY - rect.top;
        if (this.isPanning) { this.pan.x = this.panStartOffset.x + (rawX - this.panStart.x); this.pan.y = this.panStartOffset.y + (rawY - this.panStart.y); this.draw(); return; }
        const wPos = this.getWorldFromScreen(rawX, rawY);
        if (this.isDraggingComponent && this.draggedComponent) {
            const gxRaw = (wPos.x - this.boardOffset.x) / this.pitch; const gyRaw = (wPos.y - this.boardOffset.y) / this.pitch;
            const newX = Math.round(gxRaw - this.dragOffset.x);
            const newY = Math.round(gyRaw - this.dragOffset.y);

            const dx = newX - this.draggedComponent.x;
            const dy = newY - this.draggedComponent.y;

            if (dx !== 0 || dy !== 0) {
                // Determine which wires are connected to the component's *current* position (before move)
                // and move them by dx, dy.
                // Note: Wires are stored by Grid Coordinate. 
                // We use isPinAt on the component's current x,y to identify attached wires.
                this.wires.forEach(w => {
                    if (this.isPinAt(this.draggedComponent, w.x1, w.y1)) {
                        w.x1 += dx; w.y1 += dy;
                    }
                    if (this.isPinAt(this.draggedComponent, w.x2, w.y2)) {
                        w.x2 += dx; w.y2 += dy;
                    }
                });

                this.draggedComponent.x = newX;
                this.draggedComponent.y = newY;
                this.draw();
            }
            return;
        }
        if (this.isDrawing) { this.currentMousePos = { x: rawX, y: rawY }; this.draw(); }
    }

    handleMouseUp(e) {
        if (this.isPanning) { this.isPanning = false; return; }
        if (this.isDraggingComponent) {
            if (this.draggedComponent && this.dragStartPos && (this.draggedComponent.x !== this.dragStartPos.x || this.draggedComponent.y !== this.dragStartPos.y)) this.saveState();
            this.isDraggingComponent = false; this.draggedComponent = null; return;
        }
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect(); const rawX = e.clientX - rect.left; const rawY = e.clientY - rect.top;
        const wPos = this.getWorldFromScreen(rawX, rawY);
        let target = null, bestD = 20;
        const cHit = this.getComponentAt(wPos.x, wPos.y);
        if (cHit) {
            for (let py = 0; py < cHit.h; py++) {
                for (let px = 0; px < cHit.w; px++) {
                    const gx = cHit.x + px; const gy = cHit.y + py;
                    if (this.isPinAt(cHit, gx, gy)) {
                        const pos = this.getPixelsFromGrid(gx, gy);
                        const d = Math.sqrt(Math.pow(wPos.x - pos.x, 2) + Math.pow(wPos.y - pos.y, 2));
                        if (d < bestD) { bestD = d; target = { x: gx, y: gy }; }
                    }
                }
            }
        } else {
            const gHit = this.getGridFromWorld(wPos.x, wPos.y);
            const pos = this.getPixelsFromGrid(gHit.x, gHit.y);
            const d = Math.sqrt(Math.pow(wPos.x - pos.x, 2) + Math.pow(wPos.y - pos.y, 2));
            if (d < bestD) target = gHit;
        }
        if (target && this.startHole && (target.x !== this.startHole.x || target.y !== this.startHole.y)) this.addWire(this.startHole, target);
        this.isDrawing = false; this.startHole = null; this.draw();
    }

    addWire(s, e) { this.saveState(); this.wires.push({ x1: s.x, y1: s.y, x2: e.x, y2: e.y, color: this.currentWireColor, type: this.currentWireType }); }

    draw() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.translate(this.pan.x, this.pan.y);
        this.ctx.scale(this.scale, this.scale);

        this.drawBoardBacking();

        // Draw Board-type components first (Substrates)
        this.components.filter(c => c.isBoard).forEach(c => this.drawComponent(c));

        this.wires.filter(w => w.type === 'back').forEach(w => this.drawWire(w));
        this.wires.filter(w => w.type === 'front').forEach(w => this.drawWire(w));

        // Draw standard components on top
        this.components.filter(c => !c.isBoard).forEach(c => this.drawComponent(c));

        if (this.isDrawing && this.startHole && this.currentMousePos) {
            this.drawPreviewWire();
        }
    }

    drawBoardBacking() {
        const x1 = this.getPixelsFromGrid(0, 0).x, y1 = this.getPixelsFromGrid(0, 0).y;
        const x2 = this.getPixelsFromGrid(this.gridWidth - 1, this.gridHeight - 1).x, y2 = this.getPixelsFromGrid(this.gridWidth - 1, this.gridHeight - 1).y;
        const p = this.pitch / 2 + 10;
        this.ctx.fillStyle = '#404040'; this.ctx.shadowBlur = 10; this.ctx.shadowColor = 'black';
        this.ctx.fillRect(x1 - p, y1 - p, (x2 - x1) + p * 2, (y2 - y1) + p * 2);
        this.ctx.shadowBlur = 0; this.ctx.fillStyle = '#171717';
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const c = this.getPixelsFromGrid(x, y); this.ctx.beginPath(); this.ctx.arc(c.x, c.y, this.holeSize / 2, 0, Math.PI * 2); this.ctx.fill();
            }
        }
    }

    drawComponent(c) {
        const start = { x: c.x * this.pitch + this.boardOffset.x, y: c.y * this.pitch + this.boardOffset.y };
        const left = start.x - this.pitch / 2 + 2;
        const top = start.y - this.pitch / 2 + 2;
        const width = c.w * this.pitch - 4;
        const height = c.h * this.pitch - 4;

        this.ctx.fillStyle = c.isBoard ? '#404040' : '#3C3C50'; // Match board backing for Board types
        this.ctx.strokeStyle = (this.selectedElement === c) ? '#ffffff' : '#ccc';
        this.ctx.lineWidth = (this.selectedElement === c) ? 2 : 1;
        this.ctx.shadowColor = (this.selectedElement === c) ? '#ffffff' : 'transparent';
        this.ctx.shadowBlur = (this.selectedElement === c) ? 5 : 0;

        this.ctx.setLineDash([]);
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(left, top, width, height, 4); // Radius 4
        } else {
            this.ctx.rect(left, top, width, height); // Fallback
        }
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        // Draw internal holes if it's a Board type
        if (c.isBoard) {
            this.ctx.fillStyle = '#171717'; // Same hole color as main board
            for (let holeY = 0; holeY < c.h; holeY++) {
                for (let holeX = 0; holeX < c.w; holeX++) {
                    const holeGx = c.x + holeX;
                    const holeGy = c.y + holeY;
                    const pos = this.getPixelsFromGrid(holeGx, holeGy);
                    this.ctx.beginPath();
                    this.ctx.arc(pos.x, pos.y, this.holeSize / 2, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }

        const isStrip = this.shouldUseStripLayout(c);
        const isVertical = (c.rotation === 90);

        // Helper to Draw Pin
        const drawPin = (label, idx, side) => {
            if (!label || label.trim() === '') return;

            // 1. Determine Grid/Visual Position
            let gx, gy;
            if (isVertical) {
                if (side === 'top') { gx = c.x + c.w - 1; gy = c.y + idx; }
                else { gx = c.x; gy = c.y + idx; }
            } else {
                if (side === 'top') { gx = c.x + idx; gy = c.y; }
                else { gx = c.x + idx; gy = c.y + c.h - 1; }
            }

            if (isVertical) { if (idx >= c.h) return; }
            else { if (idx >= c.w) return; }

            const holePos = this.getPixelsFromGrid(gx, gy);

            // 2. Determine Pad Size
            let padW = 18, padH = 18;
            let fontSize = '8px';
            if (isStrip) {
                const pinList = (side === 'top') ? c.pinsTop : c.pinsBottom;
                const activeCount = pinList ? pinList.filter(p => p && p.trim() !== '').length : 1;

                if (isVertical) {
                    padH = (height / Math.max(1, activeCount)) - 2;
                    padW = 18;
                } else {
                    padW = (width / Math.max(1, activeCount)) - 2;
                    padH = 18;
                }
                fontSize = '10px bold';
            }

            this.ctx.fillStyle = this.getPinColor(label);
            this.ctx.beginPath();
            if (this.ctx.roundRect) {
                // Sockets rounded to match component but stricter
                this.ctx.roundRect(holePos.x - padW / 2, holePos.y - padH / 2, padW, padH, 2);
            } else {
                this.ctx.rect(holePos.x - padW / 2, holePos.y - padH / 2, padW, padH);
            }
            this.ctx.fill();

            // 3. Draw Label (CENTERED)
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = fontSize + ' Arial';
            this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';

            let tx = holePos.x;
            let ty = holePos.y;

            if (isStrip) {
                if (isVertical) {
                    // Vertical Strip: Draw Stacked Chars (Upright)
                    const chars = label.split('');
                    const lineHeight = 9;
                    const totalH = chars.length * lineHeight;
                    let startY = ty - (totalH / 2) + (lineHeight / 2);

                    this.ctx.textAlign = 'center'; // Ensure horizontal center in the vertical pad
                    chars.forEach((char, charIdx) => {
                        this.ctx.fillText(char, tx, startY + (charIdx * lineHeight));
                    });
                    return; // Done for vertical
                } else {
                    // Horizontal Strip: Center text (remove +6 offset that caused overflow)
                    // Pad Height is 18px. Font is 10px. Centered is best.
                    ty += 1;
                }
            } else {
                ty += 1;
            }
            this.ctx.fillText(label, tx, ty);
        };

        // Render Pins (Only if NOT a board substrate)
        if (!c.isBoard) {
            if (c.pinsTop) c.pinsTop.forEach((l, i) => drawPin(l, i, 'top'));
            if (c.pinsBottom) c.pinsBottom.forEach((l, i) => drawPin(l, i, 'bottom'));
        }

        // Component Label
        if (c.label) {
            this.ctx.fillStyle = isStrip ? '#FFFFFF' : 'rgba(255,255,255,0.7)';
            this.ctx.font = 'bold 12px sans-serif';

            // Check for crowding: If dimension is small (<= 2 units), usage of pads overlaps center.
            const gridDim = isVertical ? c.w : c.h;
            const isCrowded = (gridDim <= 2);

            if (isCrowded) {
                // Render Outside (Above)
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'bottom';
                // Always draw horizontal for readability when outside
                this.ctx.fillText(c.label, left + width / 2, top - 4);
            } else {
                // Render Centered (Existing)
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                const cx = left + width / 2;
                const cy = top + height / 2;

                this.ctx.save();
                this.ctx.translate(cx, cy);
                // Removed rotation: if (isVertical) this.ctx.rotate(Math.PI / 2);
                this.ctx.fillText(c.label, 0, 0);
                this.ctx.restore();
            }
        }
    }

    drawWire(wire) {
        const start = this.getPixelsFromGrid(wire.x1, wire.y1);
        const end = this.getPixelsFromGrid(wire.x2, wire.y2);
        this.ctx.beginPath(); this.ctx.moveTo(start.x, start.y); this.ctx.lineTo(end.x, end.y);
        if (this.selectedElement === wire) { this.ctx.strokeStyle = '#00FF00'; this.ctx.lineWidth = 4; this.ctx.shadowColor = '#00FF00'; this.ctx.shadowBlur = 5; }
        else { this.ctx.strokeStyle = wire.color; this.ctx.lineWidth = 3; this.ctx.shadowBlur = 0; }
        this.ctx.lineCap = 'round';
        if (wire.type === 'back') { this.ctx.setLineDash([5, 5]); this.ctx.globalAlpha = 0.7; }
        else { this.ctx.setLineDash([]); this.ctx.globalAlpha = 1.0; }
        this.ctx.stroke();
        this.ctx.setLineDash([]); this.ctx.globalAlpha = 1.0;
        this.ctx.shadowBlur = 0; this.ctx.fillStyle = '#aaa';
        this.ctx.beginPath(); this.ctx.arc(start.x, start.y, 2, 0, Math.PI * 2); this.ctx.arc(end.x, end.y, 2, 0, Math.PI * 2); this.ctx.fill();
    }

    drawPreviewWire() { /* same */
        const start = this.getPixelsFromGrid(this.startHole.x, this.startHole.y); let end;
        const worldPos = this.getWorldFromScreen(this.currentMousePos.x, this.currentMousePos.y);
        let targetPos = null; let bestDist = 20;
        const compHit = this.getComponentAt(worldPos.x, worldPos.y);
        if (compHit) {
            for (let py = 0; py < compHit.h; py++) {
                for (let px = 0; px < compHit.w; px++) {
                    const gx = compHit.x + px; const gy = compHit.y + py;
                    if (this.isPinAt(compHit, gx, gy)) {
                        const pos = this.getPixelsFromGrid(gx, gy);
                        const d = Math.sqrt(Math.pow(worldPos.x - pos.x, 2) + Math.pow(worldPos.y - pos.y, 2));
                        if (d < bestDist) { bestDist = d; targetPos = pos; }
                    }
                }
            }
        } else {
            const gridHit = this.getGridFromWorld(worldPos.x, worldPos.y);
            if (gridHit) targetPos = this.getPixelsFromGrid(gridHit.x, gridHit.y);
            if (!targetPos) targetPos = worldPos;
        }
        end = targetPos || worldPos;
        this.ctx.beginPath(); this.ctx.moveTo(start.x, start.y); this.ctx.lineTo(end.x, end.y);
        this.ctx.strokeStyle = this.currentWireColor; this.ctx.lineWidth = 3;
        if (this.currentWireType === 'back') { this.ctx.setLineDash([5, 5]); this.ctx.globalAlpha = 0.6; }
        else { this.ctx.setLineDash([]); this.ctx.globalAlpha = 0.8; }
        this.ctx.stroke(); this.ctx.setLineDash([]); this.ctx.globalAlpha = 1.0;
    }

    // --- Export Logic ---
    calculateContentBounds(padding = 20) {
        // 1. Start with Board Bounds (Visual Pixels)
        // Note: drawBoardBacking uses pitch/2 + 30 padding now.
        // User requested 30px margin specifically for the board logic in previous turn.
        // Let's align: Visual Edge (30) + Margin (30) = 60 offset from pitch edge.
        const border = this.pitch / 2 + 30 + 30;
        let minX = this.getPixelsFromGrid(0, 0).x - border;
        let minY = this.getPixelsFromGrid(0, 0).y - border;
        let maxX = this.getPixelsFromGrid(this.gridWidth - 1, this.gridHeight - 1).x + border;
        let maxY = this.getPixelsFromGrid(this.gridWidth - 1, this.gridHeight - 1).y + border;

        // 2. Expand for Components
        this.components.forEach(c => {
            const start = this.getPixelsFromGrid(c.x, c.y);
            const w = c.w * this.pitch;
            const h = c.h * this.pitch;
            // Visual boundaries including pads (approx)
            const cMinX = start.x - this.pitch / 2 - 10;
            const cMinY = start.y - this.pitch / 2 - 10;
            const cMaxX = start.x - this.pitch / 2 + w + 10;
            const cMaxY = start.y - this.pitch / 2 + h + 10;

            if (cMinX < minX) minX = cMinX;
            if (cMinY < minY) minY = cMinY;
            if (cMaxX > maxX) maxX = cMaxX;
            if (cMaxY > maxY) maxY = cMaxY;
        });

        // 3. Expand for Wires (Grid coords to Pixels)
        this.wires.forEach(w => {
            const s = this.getPixelsFromGrid(w.x1, w.y1);
            const e = this.getPixelsFromGrid(w.x2, w.y2);
            const wMinX = Math.min(s.x, e.x) - 10;
            const wMinY = Math.min(s.y, e.y) - 10;
            const wMaxX = Math.max(s.x, e.x) + 10;
            const wMaxY = Math.max(s.y, e.y) + 10;

            if (wMinX < minX) minX = wMinX;
            if (wMinY < minY) minY = wMinY;
            if (wMaxX > maxX) maxX = wMaxX;
            if (wMaxY > maxY) maxY = wMaxY;
        });

        return {
            x: minX - padding,
            y: minY - padding,
            w: (maxX - minX) + (padding * 2),
            h: (maxY - minY) + (padding * 2)
        };
    }

    exportCanvasAsImage() {
        // Save current state
        const savedCanvas = this.canvas;
        const savedCtx = this.ctx;
        const savedPan = { ...this.pan };
        const savedScale = this.scale;
        const savedW = this.canvas.width;
        const savedH = this.canvas.height;

        try {
            // Determine Bounds
            const bounds = this.calculateContentBounds(10);

            // Create Temp Canvas
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = bounds.w;
            tempCanvas.height = bounds.h;
            const tempCtx = tempCanvas.getContext('2d');

            // Swap Context
            this.canvas = tempCanvas;
            this.ctx = tempCtx;

            // Setup View for Export
            // We want (bounds.x, bounds.y) to map to (0,0)
            // So we translate by -bounds.x, -bounds.y
            // Logic in draw(): translate(pan.x, pan.y). 
            // So we set pan = {x: -bounds.x, y: -bounds.y}
            // And scale = 1.0 (Native resolution)
            this.scale = 1.0;
            this.pan = { x: -bounds.x, y: -bounds.y };

            // Draw
            this.draw();

            return tempCanvas.toDataURL('image/png');

        } finally {
            // Restore State
            this.canvas = savedCanvas;
            this.ctx = savedCtx;
            this.pan = savedPan;
            this.scale = savedScale;
            this.canvas.width = savedW;
            this.canvas.height = savedH;
            this.draw();
        }
    }

    toJSON() {
        return JSON.stringify({
            version: 1.13,
            grid: { w: this.gridWidth, h: this.gridHeight },
            wires: this.wires,
            components: this.components.map(c => ({
                id: c.id, x: c.x, y: c.y, w: c.w, h: c.h,
                label: c.label,
                pinsTop: c.pinsTop,
                pinsBottom: c.pinsBottom,
                relative: !!c.relative,
                rotate: !!c.rotate,
                isBoard: !!c.isBoard
            }))
        }, null, 2);
    }
    loadJSON(jsonString, resetHistory = true) { try { const data = JSON.parse(jsonString); if (data.grid) { this.gridWidth = data.grid.w; this.gridHeight = data.grid.h; this.updateCanvasSize(); } this.wires = data.wires || []; this.components = data.components || []; this.selectElement(null); if (resetHistory) { this.history = []; this.redoStack = []; } this.draw(); return true; } catch (e) { console.error(e); return false; } }
}
