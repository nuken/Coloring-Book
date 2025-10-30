const imageFiles = [];
for (let i = 1; i <= 10; i++) {
    imageFiles.push(`${i}.jpg`);
}

const colors = ['#575757', '#DC2323', '#2A4BD7', '#1D6914', '#814A19', '#8126C0', '#A0A0A0', '#81C57A', '#9DAFFF', '#29D0D0', '#FF9233', '#FFEE33', '#E9DEBB', '#FFCDF3', '#FFFFFF', '#000000'];
let currentTool = 'brush';
let currentColor = colors[0];
let currentBrushSize = 10;
let isPaint = false;
let lastLine;
let currentImageNode = null;
let fillHistory = [];

const container = document.querySelector('.canvas-container');
const stage = new Konva.Stage({
    container: 'container',
    width: container.offsetWidth,
    height: container.offsetHeight,
});

const backgroundLayer = new Konva.Layer();
const drawingLayer = new Konva.Layer();
stage.add(backgroundLayer, drawingLayer);


// --- UI ELEMENTS & EVENT LISTENERS ---
const colorPalette = document.getElementById('color-palette');
const brushBtn = document.getElementById('brush-btn');
const fillBtn = document.getElementById('fill-btn');
const brushSizeSlider = document.getElementById('brush-size');
const undoBtn = document.getElementById('undo-btn');
const clearBtn = document.getElementById('clear-btn');
const saveBtn = document.getElementById('save-btn');
const imageSelector = document.getElementById('image-selector');

imageFiles.forEach((fileName, index) => {
    const thumb = document.createElement('img');
    thumb.src = `images/${fileName}`;
    thumb.className = 'thumbnail';
    if (index === 0) thumb.classList.add('active');
    thumb.addEventListener('click', () => {
        document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        loadImageByName(fileName);
    });
    imageSelector.appendChild(thumb);
});

colors.forEach((color, index) => {
    const colorBox = document.createElement('div');
    colorBox.className = 'color-box';
    colorBox.style.backgroundColor = color;
    if (index === 0) colorBox.classList.add('active');
    colorBox.addEventListener('click', () => {
        currentColor = color;
        document.querySelectorAll('.color-box').forEach(box => box.classList.remove('active'));
        colorBox.classList.add('active');
    });
    colorPalette.appendChild(colorBox);
});

brushBtn.addEventListener('click', () => {
    currentTool = 'brush';
    brushBtn.classList.add('active');
    fillBtn.classList.remove('active');
});

fillBtn.addEventListener('click', () => {
    currentTool = 'fill';
    fillBtn.classList.add('active');
    brushBtn.classList.remove('active');
});

brushSizeSlider.addEventListener('input', (e) => {
    currentBrushSize = e.target.value;
});

undoBtn.addEventListener('click', () => {
    const shapes = drawingLayer.getChildren();
    if (shapes.length > 0) {
        shapes[shapes.length - 1].destroy();
        drawingLayer.batchDraw();
    }
});

// --- START: MODIFIED CODE (Fix 1) ---
// Updated clear button logic to reload the image
clearBtn.addEventListener('click', () => {
    // Find the currently active thumbnail to reload the correct image
    const activeThumb = document.querySelector('.thumbnail.active');
    if (activeThumb) {
        // Extract the file name from the image source URL
        const fileName = activeThumb.src.split('/').pop();
        // Reloading the image properly clears all drawings and fill data
        loadImageByName(fileName);
    }
});
// --- END: MODIFIED CODE (Fix 1) ---

saveBtn.addEventListener('click', () => {
    const dataURL = stage.toDataURL({
        pixelRatio: 2,
        mimeType: 'image/jpeg'
    });
    const link = document.createElement('a');
    link.download = 'coloring-page.jpg';
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- HELPER FUNCTIONS ---
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function hexToRgb(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length == 7) {
        r = parseInt("0x" + hex.slice(1, 3));
        g = parseInt("0x" + hex.slice(3, 5));
        b = parseInt("0x" + hex.slice(5, 7));
    }
    return [r, g, b];
}

function colorsMatch(data, index, color, tolerance = 20) {
    return Math.abs(data[index] - color[0]) <= tolerance &&
           Math.abs(data[index + 1] - color[1]) <= tolerance &&
           Math.abs(data[index + 2] - color[2]) <= tolerance;
}

// --- FLOOD FILL LOGIC ---
function floodFill(startX, startY, fillColorRgb) {
    // --- START: MODIFIED CODE ---
    // Get context from the Konva.Image's source canvas, not the layer's canvas
    if (!currentImageNode) return;
    const context = currentImageNode.image().getContext('2d');
    const { width, height } = context.canvas;
    const imageData = context.getImageData(0, 0, width, height);
    // --- END: MODIFIED CODE ---
    const { data } = imageData; // This line was also modified slightly

    const startIndex = (startY * width + startX) * 4;
    const startColor = [data[startIndex], data[startIndex + 1], data[startIndex + 2]];

    // Don't fill black lines
    if (startColor[0] < 30 && startColor[1] < 30 && startColor[2] < 30) {
        return;
    }
    // Don't fill if already the same color
    if (colorsMatch(data, startIndex, fillColorRgb, 10)) {
        return;
    }

    const isBoundary = (index) => !colorsMatch(data, index, startColor, 35);
    const stack = [[startX, startY]];
    const fillColor = [...fillColorRgb, 255]; // Add alpha channel

    while (stack.length > 0) {
        const [x, y] = stack.pop();
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const currentIndex = (y * width + x) * 4;

        // Check if already filled
        if (data[currentIndex] === fillColor[0] &&
            data[currentIndex + 1] === fillColor[1] &&
            data[currentIndex + 2] === fillColor[2]) {
            continue;
        }
        // Check if it's a boundary
        if (isBoundary(currentIndex)) {
            continue;
        }

        // Fill the pixel
        data[currentIndex] = fillColor[0];
        data[currentIndex + 1] = fillColor[1];
        data[currentIndex + 2] = fillColor[2];
        data[currentIndex + 3] = fillColor[3];

        // Add neighbors to stack
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    context.putImageData(imageData, 0, 0);
}

// --- CANVAS LOGIC ---
function fitImageToContainer(image) {
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    const imageRatio = image.width / image.height;
    const containerRatio = containerWidth / containerHeight;
    let newWidth, newHeight;
    if (imageRatio > containerRatio) {
        newWidth = containerWidth;
        newHeight = containerWidth / imageRatio;
    } else {
        newHeight = containerHeight;
        newWidth = containerHeight * imageRatio;
    }
    return {
        width: newWidth,
        height: newHeight,
        x: (containerWidth - newWidth) / 2,
        y: (containerHeight - newHeight) / 2,
    };
}

function loadImageByName(fileName) {
    drawingLayer.destroyChildren();
    backgroundLayer.destroyChildren();
    fillHistory = [];
    const imageUrl = `images/${fileName}`;
    Konva.Image.fromURL(imageUrl, (imageNode) => {
        // --- START: MODIFIED CODE ---
        // Create an off-screen canvas and use it as the image source
        // This allows us to modify its pixels for flood fill
        const img = imageNode.image();
        const offscreenCanvas = document.createElement('canvas');
        // Use the original image dimensions for the source canvas
        offscreenCanvas.width = img.naturalWidth || img.width;
        offscreenCanvas.height = img.naturalHeight || img.height;
        offscreenCanvas.getContext('2d').drawImage(img, 0, 0);

        // Set the Konva.Image to use our new canvas as its source
        imageNode.image(offscreenCanvas);
        currentImageNode = imageNode;
        // --- END: MODIFIED CODE ---

        const dimensions = fitImageToContainer(imageNode.image());
        imageNode.setAttrs({ ...dimensions, name: 'coloringImage' });

        // --- START: Brush Clipping Fix ---
        // Add a clipping function to the drawing layer to keep brush in bounds
        drawingLayer.clipFunc(function (ctx) {
            ctx.rect(dimensions.x, dimensions.y, dimensions.width, dimensions.height);
        });
        // --- END: Brush Clipping Fix ---

        backgroundLayer.add(imageNode);
        backgroundLayer.batchDraw();
    });
}

stage.on('click tap', (e) => {
    if (currentTool === 'fill' && currentImageNode) {
        const pos = stage.getPointerPosition();

        const relativeX = (pos.x - currentImageNode.x()) / currentImageNode.width();
        const relativeY = (pos.y - currentImageNode.y()) / currentImageNode.height();

        if (relativeX >= 0 && relativeX <= 1 && relativeY >= 0 && relativeY <= 1) {
            const fillColor = hexToRgb(currentColor);
            fillHistory.push({ relativeX, relativeY, color: fillColor });

            // --- START: MODIFIED CODE ---
            // Calculate x/y relative to the source canvas, not the stage
            const sourceCanvas = currentImageNode.image();
            const x = Math.floor(relativeX * sourceCanvas.width);
            const y = Math.floor(relativeY * sourceCanvas.height);

            floodFill(x, y, fillColor);

            // Redraw the layer to show the change from the modified source
            backgroundLayer.batchDraw();
            // --- END: MODIFIED CODE ---
        }
    }
});

stage.on('mousedown touchstart', (e) => {
    if (currentTool !== 'brush') return;
    isPaint = true;
    const pos = stage.getPointerPosition();
    lastLine = new Konva.Line({
        stroke: currentColor,
        strokeWidth: currentBrushSize,
        globalCompositeOperation: 'source-over',
        lineCap: 'round', lineJoin: 'round',
        points: [pos.x, pos.y, pos.x, pos.y],
    });
    drawingLayer.add(lastLine);
});

stage.on('mouseup touchend', () => { isPaint = false; });

stage.on('mousemove touchmove', (e) => {
    if (!isPaint || currentTool !== 'brush') return;
    e.evt.preventDefault();
    const pos = stage.getPointerPosition();
    const newPoints = lastLine.points().concat([pos.x, pos.y]);
    lastLine.points(newPoints);
    drawingLayer.batchDraw();
});

// --- RESIZE LOGIC ---
const handleResize = debounce(() => {
    if (!currentImageNode) return;

    const oldDimensions = {
        x: currentImageNode.x(),
        y: currentImageNode.y(),
        width: currentImageNode.width(),
        height: currentImageNode.height()
    };

    // --- Get padding for accurate stage sizing ---
    const style = window.getComputedStyle(container);
    const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

    stage.width(container.clientWidth - paddingX);
    stage.height(container.clientHeight - paddingY);
    // --- End padding logic ---

    const newDimensions = fitImageToContainer(currentImageNode.image());
    currentImageNode.setAttrs(newDimensions);

    // --- START: Brush Clipping Fix ---
    // Update the clipping area on resize
    drawingLayer.clipFunc(function (ctx) {
        ctx.rect(newDimensions.x, newDimensions.y, newDimensions.width, newDimensions.height);
    });
    // --- END: Brush Clipping Fix ---

    // Reposition brush strokes
    drawingLayer.getChildren().forEach(shape => {
        if (shape instanceof Konva.Line) {
            const oldPoints = shape.points();
            const newPoints = [];
            for (let i = 0; i < oldPoints.length; i += 2) {
                const relativeX = (oldPoints[i] - oldDimensions.x) / oldDimensions.width;
                const relativeY = (oldPoints[i + 1] - oldDimensions.y) / oldDimensions.height;
                newPoints.push(
                    (relativeX * newDimensions.width) + newDimensions.x,
                    (relativeY * newDimensions.height) + newDimensions.y
                );
            }
            shape.points(newPoints);
        }
    });

    stage.batchDraw();

    // Re-apply fills after resize
    requestAnimationFrame(() => {
        // --- START: MODIFIED CODE ---
        // Get the source canvas once
        if (!currentImageNode) return;
        const sourceCanvas = currentImageNode.image();

        fillHistory.forEach(fill => {
            // Calculate target x/y relative to the source canvas
            const targetX = Math.floor(fill.relativeX * sourceCanvas.width);
            const targetY = Math.floor(fill.relativeY * sourceCanvas.height);
            floodFill(targetX, targetY, fill.color);
        });

        // After all fills are re-applied, redraw the background layer
        if (fillHistory.length > 0) {
            backgroundLayer.batchDraw();
        }
        // --- END: MODIFIED CODE ---
    });

}, 250);

window.addEventListener('resize', handleResize);

// --- INITIAL LOAD ---
loadImageByName(imageFiles[0]);


