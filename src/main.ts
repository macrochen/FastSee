import './style.css'
// @ts-ignore
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

// Types
interface ImageItem {
  file: File;
  url: string;
}

// State
let currentImages: ImageItem[] = [];
let currentImageIndex = 0;
let zoomLevel = 1;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let translateX = 0;
let translateY = 0;

// DOM Elements
const welcomeView = document.getElementById('welcome-view')!;
const gridView = document.getElementById('grid-view')!;
const viewerView = document.getElementById('viewer-view')!;

const openBtn = document.getElementById('open-btn')!;
const reopenBtn = document.getElementById('reopen-btn')!;
const folderNameEl = document.getElementById('folder-name')!;
const fileCountEl = document.getElementById('file-count')!;
const gridContainer = document.getElementById('grid-container')!;

const viewerImg = document.getElementById('viewer-img') as HTMLImageElement;
const viewerFilename = document.getElementById('viewer-filename')!;
const closeViewerBtn = document.getElementById('close-viewer-btn')!;
const prevBtn = document.getElementById('prev-btn')!;
const nextBtn = document.getElementById('next-btn')!;
const zoomLevelEl = document.getElementById('zoom-level')!;
const zoomInBtn = document.getElementById('zoom-in-btn')!;
const zoomOutBtn = document.getElementById('zoom-out-btn')!;
const zoomResetBtn = document.getElementById('zoom-reset-btn')!;

// File System Access API
async function openFolder() {
  try {
    // @ts-ignore - File System Access API types might not be fully available
    const dirHandle = await window.showDirectoryPicker({
      mode: 'read'
    });
    
    currentImages = [];
    folderNameEl.textContent = dirHandle.name;
    
    // @ts-ignore
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const fileHandle = entry;
        const file = await fileHandle.getFile();
        
        const fileName = file.name.toLowerCase();
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
        const isImage = file.type.startsWith('image/') || imageExtensions.some(ext => fileName.endsWith(ext));
        
        if (isImage) {
          currentImages.push({
            file,
            url: URL.createObjectURL(file)
          });
        }
      }
    }
    
    console.log(`Found ${currentImages.length} images.`);
    
    // Sort files by name
    currentImages.sort((a, b) => a.file.name.localeCompare(b.file.name));
    
    if (currentImages.length > 0) {
      renderGrid();
      showView(gridView);
    } else {
      alert('No images found in the selected folder.');
    }
    
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.error('Error opening folder:', err);
      alert('Could not open folder. ' + err.message);
    }
  }
}

function showView(view: HTMLElement) {
  welcomeView.classList.remove('active');
  gridView.classList.remove('active');
  viewerView.classList.remove('active');
  
  // Ensure we also remove the 'hidden' class that was initially in HTML
  welcomeView.classList.remove('hidden');
  gridView.classList.remove('hidden');
  viewerView.classList.remove('hidden');
  
  view.classList.add('active');
}

function renderGrid() {
  fileCountEl.textContent = `${currentImages.length} images`;
  gridContainer.innerHTML = '';
  
  currentImages.forEach((item, index) => {
    const el = document.createElement('div');
    el.className = 'thumbnail-item';
    
    const img = document.createElement('img');
    img.src = item.url;
    img.loading = 'lazy';
    img.alt = item.file.name;
    
    const label = document.createElement('div');
    label.className = 'thumbnail-name';
    label.textContent = item.file.name;
    
    el.appendChild(img);
    el.appendChild(label);
    
    el.addEventListener('click', () => openViewer(index));
    gridContainer.appendChild(el);
  });
}

function openViewer(index: number) {
  currentImageIndex = index;
  updateViewer();
  showView(viewerView);
  resetZoom();
}

function closeViewer() {
  showView(gridView);
}

function updateViewer() {
  const item = currentImages[currentImageIndex];
  if (!item) return;
  
  viewerImg.src = item.url;
  viewerFilename.textContent = item.file.name;
  
  // Clean up object URL memory when navigating away? 
  // No, we need them for the grid too.
}

function goPrev() {
  if (currentImageIndex > 0) {
    currentImageIndex--;
    updateViewer();
    resetZoom();
  }
}

function goNext() {
  if (currentImageIndex < currentImages.length - 1) {
    currentImageIndex++;
    updateViewer();
    resetZoom();
  }
}

// Zoom and Pan Logic
function resetZoom() {
  zoomLevel = 1;
  translateX = 0;
  translateY = 0;
  applyTransform();
}

function handleZoom(delta: number, centerX?: number, centerY?: number) {
  const oldZoom = zoomLevel;
  zoomLevel += delta;
  zoomLevel = Math.max(0.1, Math.min(zoomLevel, 10)); // Min 10%, Max 1000%
  
  // Try to zoom towards cursor if provided, otherwise center
  if (centerX !== undefined && centerY !== undefined && oldZoom !== zoomLevel) {
    const rect = viewerImg.getBoundingClientRect();
    // Calculate how much the mouse is offset from the center
    const rx = (centerX - rect.left - rect.width / 2) / oldZoom;
    const ry = (centerY - rect.top - rect.height / 2) / oldZoom;
    
    translateX -= rx * (zoomLevel - oldZoom);
    translateY -= ry * (zoomLevel - oldZoom);
  }
  
  applyTransform();
}

function applyTransform() {
  viewerImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${zoomLevel})`;
  zoomLevelEl.textContent = `${Math.round(zoomLevel * 100)}%`;
}

// Drag events
viewerImg.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return; // Only left click
  isDragging = true;
  dragStartX = e.clientX - translateX;
  dragStartY = e.clientY - translateY;
  e.preventDefault(); // Prevent default image drag
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  translateX = e.clientX - dragStartX;
  translateY = e.clientY - dragStartY;
  applyTransform();
});

window.addEventListener('mouseup', () => {
  isDragging = false;
});

// Wheel zoom
viewerView.addEventListener('wheel', (e) => {
  if (!viewerView.classList.contains('active')) return;
  e.preventDefault(); // Prevent scrolling
  
  const zoomSpeed = 0.1;
  const delta = e.deltaY < 0 ? zoomSpeed : -zoomSpeed;
  handleZoom(delta, e.clientX, e.clientY);
}, { passive: false });

// Event Listeners
openBtn.addEventListener('click', openFolder);
reopenBtn.addEventListener('click', openFolder);
closeViewerBtn.addEventListener('click', closeViewer);
prevBtn.addEventListener('click', goPrev);
nextBtn.addEventListener('click', goNext);

zoomInBtn.addEventListener('click', () => handleZoom(0.2));
zoomOutBtn.addEventListener('click', () => handleZoom(-0.2));
zoomResetBtn.addEventListener('click', resetZoom);

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (viewerView.classList.contains('active')) {
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowLeft') goPrev();
    if (e.key === 'ArrowRight') goNext();
    if (e.key === '=' || e.key === '+') handleZoom(0.2);
    if (e.key === '-') handleZoom(-0.2);
    if (e.key === '0') resetZoom();
  }
});
