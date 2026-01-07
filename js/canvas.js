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

        // Undo/Redo History
        this.history = [];
        this.redoStack = [];
        this.maxHistory = 50;

        // Interaction
        this.isDrawing = false;
        this.isDraggingComponent = false;
        this.draggedComponent = null;
        this.selectedElement = null;
        this.dragOffset = { x: 0, y: 0 };
        this.dragStartPos = null;

        this.startHole = null;
        this.currentMousePos = null;

        this.currentWireColor = '#FF0000';
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
            this.draggedComponent = null;
            this.draw();
        });

        // Ensure canvas can be focused
        this.canvas.setAttribute('tabindex', '0');
        this.canvas.style.outline = 'none';
    }

    // --- History Management ---
    saveState() {
        const state = this.toJSON();
        this.history.push(state);
        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        this.redoStack = [];
    }

    undo() {
        if (this.history.length === 0) return;

        // Save current to redo
        const currentState = this.toJSON();
        this.redoStack.push(currentState);

        const prevState = this.history.pop();
        this.loadJSON(prevState, false);
    }

    redo() {
        if (this.redoStack.length === 0) return;

        // Save current to history
        const currentState = this.toJSON();
        this.history.push(currentState);

        const nextState = this.redoStack.pop();
        this.loadJSON(nextState, false);
    }

    // --- Actions ---
    deleteSelected() {
        if (!this.selectedElement) return;

        this.saveState();

        if (this.selectedElement.id) {
            // Component
            this.components = this.components.filter(c => c !== this.selectedElement);
        } else {
            // Wire
            this.wires = this.wires.filter(w => w !== this.selectedElement);
        }

        this.selectElement(null);
        this.draw();
    }

    resizeBoard(w, h) {
        this.saveState();
        this.gridWidth = w;
        this.gridHeight = h;
        this.updateCanvasSize();
        this.draw();
    }

    updateCanvasSize() {
        const boardPixelW = (this.gridWidth - 1) * this.pitch;
        const boardPixelH = (this.gridHeight - 1) * this.pitch;
        this.canvas.width = boardPixelW + (this.boardOffset.x * 2) + this.margin;
        this.canvas.height = boardPixelH + (this.boardOffset.y * 2) + this.margin;
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

    addComponent(w, h, label = '', pinsStr = '') {
        this.saveState();
        const id = Date.now().toString();
        const x = 2;
        const y = 2;

        let pinLabels = [];
        if (pinsStr) pinLabels = pinsStr.split(',').map(s => s.trim());

        const newComp = { id, x, y, w, h, label, pinLabels };
        this.components.push(newComp);
        this.selectElement(newComp);
        this.draw();
    }

    updateSelectedComponent(w, h, label, pinsStr) {
        if (!this.selectedElement || !this.selectedElement.id) return;

        this.saveState();
        this.selectedElement.w = w;
        this.selectedElement.h = h;
        this.selectedElement.label = label;

        let pinLabels = [];
        if (pinsStr) pinLabels = pinsStr.split(',').map(s => s.trim());
        this.selectedElement.pinLabels = pinLabels;

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

    // --- Hit Testing ---
    getGridFromPixels(px, py) {
        const xRaw = (px - this.boardOffset.x) / this.pitch;
        const yRaw = (py - this.boardOffset.y) / this.pitch;
        const x = Math.round(xRaw);
        const y = Math.round(yRaw);

        const dx = (x * this.pitch) - (px - this.boardOffset.x);
        const dy = (y * this.pitch) - (py - this.boardOffset.y);
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 40% of pitch threshold
        if (dist < this.pitch * 0.4) return { x, y };
        return null;
    }

    getPixelsFromGrid(gx, gy) {
        return {
            x: gx * this.pitch + this.boardOffset.x,
            y: gy * this.pitch + this.boardOffset.y
        };
    }

    getComponentAt(px, py) {
        for (let i = this.components.length - 1; i >= 0; i--) {
            const c = this.components[i];
            const start = this.getPixelsFromGrid(c.x, c.y);

            const left = start.x - this.pitch / 2;
            const top = start.y - this.pitch / 2;
            const width = c.w * this.pitch;
            const height = c.h * this.pitch;

            if (px >= left && px <= left + width &&
                py >= top && py <= top + height) {
                return c;
            }
        }
        return null;
    }

    getWireAt(px, py) {
        const threshold = 10;

        for (let i = this.wires.length - 1; i >= 0; i--) {
            const w = this.wires[i];
            const start = this.getPixelsFromGrid(w.x1, w.y1);
            const end = this.getPixelsFromGrid(w.x2, w.y2);

            const dist = this.pointToLineDistance(px, py, start.x, start.y, end.x, end.y);
            if (dist < threshold) {
                return w;
            }
        }
        return null;
    }

    pointToLineDistance(x, y, x1, y1, x2, y2) {
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq !== 0)
            param = dot / len_sq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // --- Handlers ---
    handleMouseDown(e) {
        // Force focus to canvas to ensure key events are captured
        this.canvas.focus();

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // 1. Check for Component (High Priority - Dragging)
        const hitComponent = this.getComponentAt(mouseX, mouseY);
        if (hitComponent) {
            this.selectElement(hitComponent);
            this.isDraggingComponent = true;
            this.draggedComponent = hitComponent;
            this.dragStartPos = { x: hitComponent.x, y: hitComponent.y };

            const gridPos = this.getGridFromPixels(mouseX, mouseY);
            if (gridPos) {
                this.dragOffset = { x: gridPos.x - hitComponent.x, y: gridPos.y - hitComponent.y };
            } else {
                this.dragOffset = { x: 0, y: 0 };
            }
            return;
        }

        // 2. Check for Grid Hole match (START DRAWING PRIORITY)
        // If we click on a hole, we likely want to start a wire, not select a wire passing through it.
        const gridPos = this.getGridFromPixels(mouseX, mouseY);
        if (gridPos) {
            this.isDrawing = true;
            this.startHole = gridPos;
            this.currentMousePos = { x: mouseX, y: mouseY };

            // Implicitly deselect
            if (this.selectedElement) {
                this.selectElement(null);
            }
            this.draw();
            return;
        }

        // 3. Check for Wire (Selection Priority - only if NOT on a hole)
        const hitWire = this.getWireAt(mouseX, mouseY);
        if (hitWire) {
            this.selectElement(hitWire);
            return;
        }

        // 4. Empty space -> Deselect
        if (this.selectedElement) {
            this.selectElement(null);
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (this.isDraggingComponent && this.draggedComponent) {
            const xRaw = Math.round((mouseX - this.boardOffset.x) / this.pitch);
            const yRaw = Math.round((mouseY - this.boardOffset.y) / this.pitch);

            let newX = xRaw - this.dragOffset.x;
            let newY = yRaw - this.dragOffset.y;

            this.draggedComponent.x = newX;
            this.draggedComponent.y = newY;

            this.draw();
            return;
        }

        const gridPos = this.getGridFromPixels(mouseX, mouseY);

        if (this.isDrawing) {
            this.currentMousePos = { x: mouseX, y: mouseY };
            this.draw();
        }
    }

    handleMouseUp(e) {
        if (this.isDraggingComponent) {
            if (this.draggedComponent && this.dragStartPos) {
                // If moved
                if (this.draggedComponent.x !== this.dragStartPos.x ||
                    this.draggedComponent.y !== this.dragStartPos.y) {

                    const newX = this.draggedComponent.x;
                    const newY = this.draggedComponent.y;

                    // Revert to start, save state, apply new
                    this.draggedComponent.x = this.dragStartPos.x;
                    this.draggedComponent.y = this.dragStartPos.y;

                    this.saveState();

                    this.draggedComponent.x = newX;
                    this.draggedComponent.y = newY;
                }
            }
            this.isDraggingComponent = false;
            this.draggedComponent = null;
            return;
        }

        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        const endGridPos = this.getGridFromPixels(e.clientX - rect.left, e.clientY - rect.top);

        if (endGridPos && this.startHole) {
            if (endGridPos.x !== this.startHole.x || endGridPos.y !== this.startHole.y) {
                this.addWire(this.startHole, endGridPos);
            }
        }

        this.isDrawing = false;
        this.startHole = null;
        this.draw();
    }

    addWire(start, end) {
        this.saveState();
        this.wires.push({
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
            color: this.currentWireColor,
            type: this.currentWireType
        });
    }

    // --- Rendering ---
    draw() {
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawBoardBacking();

        this.wires.filter(w => w.type === 'back').forEach(w => this.drawWire(w));
        this.wires.filter(w => w.type === 'front').forEach(w => this.drawWire(w));
        this.components.forEach(c => this.drawComponent(c));

        if (this.isDrawing && this.startHole && this.currentMousePos) {
            this.drawPreviewWire();
        }
    }

    drawBoardBacking() {
        const x1 = this.getPixelsFromGrid(0, 0).x;
        const y1 = this.getPixelsFromGrid(0, 0).y;
        const x2 = this.getPixelsFromGrid(this.gridWidth - 1, this.gridHeight - 1).x;
        const y2 = this.getPixelsFromGrid(this.gridWidth - 1, this.gridHeight - 1).y;

        const padding = this.pitch / 2 + 10;

        this.ctx.fillStyle = '#252525';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = 'black';
        this.ctx.fillRect(x1 - padding, y1 - padding, (x2 - x1) + padding * 2, (y2 - y1) + padding * 2);
        this.ctx.shadowBlur = 0;

        this.ctx.fillStyle = '#111';
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const center = this.getPixelsFromGrid(x, y);
                this.ctx.beginPath();
                this.ctx.arc(center.x, center.y, this.holeSize / 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    drawComponent(c) {
        const start = this.getPixelsFromGrid(c.x, c.y);
        const left = start.x - this.pitch / 2 + 2;
        const top = start.y - this.pitch / 2 + 2;
        const width = c.w * this.pitch - 4;
        const height = c.h * this.pitch - 4;

        this.ctx.fillStyle = 'rgba(60, 60, 80, 0.9)';

        if (this.selectedElement === c) {
            this.ctx.strokeStyle = '#4a90e2';
            this.ctx.lineWidth = 2;
            this.ctx.shadowColor = '#4a90e2';
            this.ctx.shadowBlur = 5;
        } else {
            this.ctx.strokeStyle = '#ccc';
            this.ctx.lineWidth = 1;
            this.ctx.shadowBlur = 0;
        }

        this.ctx.setLineDash([]);
        this.ctx.fillRect(left, top, width, height);
        this.ctx.strokeRect(left, top, width, height);
        this.ctx.shadowBlur = 0;

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        let pinIndex = 0;

        for (let py = 0; py < c.h; py++) {
            for (let px = 0; px < c.w; px++) {
                const holePos = this.getPixelsFromGrid(c.x + px, c.y + py);

                this.ctx.fillStyle = '#FFD700';
                this.ctx.beginPath();
                this.ctx.arc(holePos.x, holePos.y, 3, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.fillStyle = '#FFF';
                this.ctx.beginPath();
                this.ctx.arc(holePos.x - 1, holePos.y - 1, 1, 0, Math.PI * 2);
                this.ctx.fill();

                if (c.pinLabels && c.pinLabels[pinIndex]) {
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.font = '9px Arial';
                    this.ctx.fillText(c.pinLabels[pinIndex], holePos.x, holePos.y - 8);
                }
                pinIndex++;
            }
        }

        if (c.label) {
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 12px sans-serif';
            const cx = left + width / 2;
            const cy = top + height / 2;
            this.ctx.fillText(c.label, cx, cy);
        }
    }

    drawWire(wire) {
        const start = this.getPixelsFromGrid(wire.x1, wire.y1);
        const end = this.getPixelsFromGrid(wire.x2, wire.y2);

        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);

        if (this.selectedElement === wire) {
            this.ctx.strokeStyle = '#00FF00';
            this.ctx.lineWidth = 4;
            this.ctx.shadowColor = '#00FF00';
            this.ctx.shadowBlur = 5;
        } else {
            this.ctx.strokeStyle = wire.color;
            this.ctx.lineWidth = 3;
            this.ctx.shadowBlur = 0;
        }

        this.ctx.lineCap = 'round';

        if (wire.type === 'back') {
            this.ctx.setLineDash([5, 5]);
            this.ctx.globalAlpha = 0.7;
        } else {
            this.ctx.setLineDash([]);
            this.ctx.globalAlpha = 1.0;
        }

        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1.0;
        this.ctx.shadowBlur = 0;

        this.ctx.fillStyle = '#aaa';
        this.ctx.beginPath();
        this.ctx.arc(start.x, start.y, 2, 0, Math.PI * 2);
        this.ctx.arc(end.x, end.y, 2, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawPreviewWire() {
        const start = this.getPixelsFromGrid(this.startHole.x, this.startHole.y);
        let end = this.currentMousePos;
        const gridHover = this.getGridFromPixels(this.currentMousePos.x, this.currentMousePos.y);
        if (gridHover) end = this.getPixelsFromGrid(gridHover.x, gridHover.y);

        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);

        this.ctx.strokeStyle = this.currentWireColor;
        this.ctx.lineWidth = 3;

        if (this.currentWireType === 'back') {
            this.ctx.setLineDash([5, 5]);
            this.ctx.globalAlpha = 0.6;
        } else {
            this.ctx.setLineDash([]);
            this.ctx.globalAlpha = 0.8;
        }

        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1.0;
    }

    toJSON() {
        return JSON.stringify({
            version: 1.3,
            grid: { w: this.gridWidth, h: this.gridHeight },
            wires: this.wires,
            components: this.components
        }, null, 2);
    }

    loadJSON(jsonString, resetHistory = true) {
        try {
            const data = JSON.parse(jsonString);
            if (data.grid) {
                this.gridWidth = data.grid.w || 30;
                this.gridHeight = data.grid.h || 20;
                this.updateCanvasSize();
            }
            this.wires = data.wires || [];
            this.components = data.components || [];
            this.selectElement(null);

            if (resetHistory) {
                this.history = [];
                this.redoStack = [];
            }

            this.draw();
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
}
