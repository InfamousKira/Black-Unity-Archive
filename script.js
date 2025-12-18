// --- Global Variables ---
let archiveData = []; 
let lastActiveListSection = 'home'; // Tracks the last view for the 'Back' button

// --- Core Initialization Function ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Data and Build Interface
    loadDataAndBuildInterface();
    // 2. Load User Notes (using localStorage)
    loadAllNotes();
});

// --- Data Loading and Interface Builder (REPLACE THIS FUNCTION IN SCRIPT.JS) ---
async function loadDataAndBuildInterface() {
    const loadingMessage = document.getElementById('loadingMessage');
    try {
        const response = await fetch('data.json');
        archiveData = await response.json();
        
        // --- CORE FIXES START HERE ---
        
        // 1. Build Section Grids (Needs to happen first)
        renderContentGrids(archiveData);

        // 2. Set Daily Review Entry
        renderDailyReview();

        // 3. Build Timeline
        renderTimeline(archiveData);
        
        // 4. Show the initial Home section *and then* hide the loading message
        showSection('home');
        loadingMessage.style.display = 'none'; // Hides the message after content is ready

        // --- CORE FIXES END HERE ---

    } catch (error) {
        console.error('Error loading or parsing data.json:', error);
        loadingMessage.innerHTML = '<p style="color: red;">Error loading archive data. Please check the data.json file path and format.</p>';
    }
}

// --- Navigation and Section Management ---
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('section').forEach(section => {
        section.classList.remove('active');
        section.classList.add('hidden');
    });

    // Show the requested section
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.add('active');
        activeSection.classList.remove('hidden');
    }
    
    if (sectionId !== 'detailPage') {
        lastActiveListSection = sectionId;
    }

    // --- THE FIX IS HERE ---
    if (sectionId === 'home') {
        renderDailyReview();
    } else if (sectionId === 'mindmap') {
        // We clear the container and rebuild it every time the tab is clicked
        // This ensures the map correctly calculates the size of the box
        const container = document.getElementById('mindmapContainer');
        container.innerHTML = ''; 
        renderMindMap(archiveData);
    }
}

function hideDetailPage() {
    document.getElementById('detailPage').classList.add('hidden');
    // Go back to the last active list section
    showSection(lastActiveListSection); 
}


// --- Content Rendering Functions ---

function renderDailyReview() {
    const dailyReviewEl = document.getElementById('dailyReviewContent');
    if (!archiveData.length) return;

    const day = new Date();
    const index = Math.floor(day.getTime() / (1000 * 60 * 60 * 24)) % archiveData.length;
    const item = archiveData[index];

    dailyReviewEl.innerHTML = `
        <h3 class="card-title">${item.name} (${item.type})</h3>
        <p><strong>Period:</strong> ${item.dates}</p>
        <p>${item.summary}</p>
        <button onclick="showDetail('${item.id}')">Learn More</button>
    `;
}

function renderContentGrids(data) {
    const personsGrid = document.getElementById('personsGrid');
    const movementsGrid = document.getElementById('movementsGrid');
    
    personsGrid.innerHTML = data.length === 0 ? '<p style="color: gray;">No Persons found matching your search.</p>' : '';
    movementsGrid.innerHTML = data.length === 0 ? '<p style="color: gray;">No Movements/Events found matching your search.</p>' : '';

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'content-card';
        // Changed onclick to only call showDetail, as we track the source view with lastActiveListSection
        card.onclick = () => showDetail(item.id); 
        
        card.innerHTML = `
            <h3 class="card-title">${item.name}</h3>
            <p><strong>Type:</strong> ${item.type}</p>
            <p><strong>Key Terms:</strong> ${item.key_terms.join(', ')}</p>
        `;
        
        if (item.type === 'Person') {
            personsGrid.appendChild(card);
        } else if (item.type === 'Movement' || item.type === 'Event') {
            movementsGrid.appendChild(card);
        }
    });
}

function showDetail(id) {
    const item = archiveData.find(d => d.id === id);
    if (!item) return;

    // Hide current view and show the detail page
    showSection('detailPage');

    // Populate detail page content
    document.getElementById('detailTitle').textContent = item.name;
    document.getElementById('detailDates').textContent = `Period: ${item.dates}`;
    // InnerHTML allows the detail text to use bold/italics etc. from data.json
    document.getElementById('detailContent').innerHTML = item.detail; 

    // Populate sources
    const sourcesList = document.getElementById('detailSources');
    sourcesList.innerHTML = item.sources.map(src => `<li>${src}</li>`).join('');

    // Load and save detail notes for this specific entry
    const notesId = `notes-${item.id}`;
    const detailNotesArea = document.getElementById('detailNotes');
    detailNotesArea.id = notesId; // Update the ID
    loadNotes(notesId); 
    detailNotesArea.onkeyup = () => saveNotes(notesId);
}


// --- Search Functionality (Improved) ---

function filterContent() {
    const input = document.getElementById('searchInput');
    const filter = input.value.toUpperCase().trim();

    if (filter === '') {
        renderContentGrids(archiveData);
        // Do not switch view if search is cleared
        return; 
    }

    const filteredData = archiveData.filter(item => {
        // Search across name, summary, and key terms
        const nameMatch = item.name.toUpperCase().includes(filter);
        const summaryMatch = item.summary.toUpperCase().includes(filter);
        const keyTermsMatch = item.key_terms.some(term => term.toUpperCase().includes(filter));
        
        return nameMatch || summaryMatch || keyTermsMatch;
    });

    renderContentGrids(filteredData);
    
    // Automatically switch to the Persons tab to show the filtered results
    // We update the lastActiveListSection to be 'persons' so 'Back' works correctly
    showSection('persons');
}


// --- Timeline Rendering ---

function renderTimeline(data) {
    const timelineEl = document.getElementById('timelineContainer');
    timelineEl.innerHTML = '';

    // Sort by the first year mentioned in the dates field
    const sortedData = [...data].sort((a, b) => {
        const yearA = parseInt(a.dates.split('-')[0]);
        const yearB = parseInt(b.dates.split('-')[0]);
        return yearA - yearB;
    });

    sortedData.forEach(item => {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'timeline-event';
        eventDiv.onclick = () => showDetail(item.id); // Make the timeline event clickable
        eventDiv.innerHTML = `
            <h4>${item.dates}</h4>
            <p><strong class="card-title">${item.name}</strong> (${item.type})</p>
            <p>${item.summary}</p>
        `;
        timelineEl.appendChild(eventDiv);
    });
    // 
}


// --- Mind Map (Vis.js Network) Rendering (Improved Options) ---
// --- Updated Mind Map Function with Light Labels ---
function renderMindMap(data) {
    const nodes = [];
    const edges = [];
    const colorMap = {
        'Person': '#A0522D', 
        'Movement': '#DAA520', 
        'Event': '#F8F8FF' 
    };

    data.forEach(item => {
        nodes.push({
            id: item.id,
            label: item.name,
            title: item.summary,
            color: { 
                background: colorMap[item.type] || '#778899', 
                border: '#FFF',
                highlight: { background: '#DAA520', border: '#FFF' }
            },
            shape: 'box',
            margin: 10,
            // 🟢 FIX: Light color for labels
            font: { color: '#F8F8FF', size: 16, face: 'Georgia' } 
        });
    });

    data.forEach(sourceItem => {
        if (sourceItem.connections && Array.isArray(sourceItem.connections)) {
            sourceItem.connections.forEach(targetName => {
                const targetItem = data.find(item => item.name === targetName);
                if (targetItem) {
                    edges.push({
                        from: sourceItem.id,
                        to: targetItem.id,
                        arrows: 'to',
                        color: { color: '#DAA520', opacity: 0.4 },
                        width: 2
                    });
                }
            });
        }
    });

    const networkData = {
        nodes: new vis.DataSet(nodes),
        edges: new vis.DataSet(edges)
    };

    const container = document.getElementById('mindmapContainer');
    const options = {
        physics: {
            enabled: true,
            stabilization: { iterations: 200 }
        },
        interaction: {
            hover: true,
            dragNodes: true, // Allows him to reorganize by dragging
            navigationButtons: true
        },
        manipulation: {
            enabled: false // Set to true if you want him to be able to manually add lines
        }
    };

    // Store the network in a variable so we can access it for the reset
    window.network = new vis.Network(container, networkData, options);
}

// 🟢 NEW FUNCTION: Reset the Map
function resetMindMap() {
    if (window.network) {
        window.network.fit(); // Zooms back out to show everything
        // Or, to completely rebuild it:
        const container = document.getElementById('mindmapContainer');
        container.innerHTML = '';
        renderMindMap(archiveData);
    }
}

// --- Notes Persistence (localStorage) ---

function saveNotes(id) {
    const textarea = document.getElementById(id);
    if (textarea) {
        localStorage.setItem(id, textarea.value);
    }
}

function loadNotes(id) {
    const textarea = document.getElementById(id);
    if (textarea) {
        textarea.value = localStorage.getItem(id) || '';
    }
}

function loadAllNotes() {
    // Load notes for persistent section textareas
    loadNotes('homeNotes');
    loadNotes('timelineNotes');
    loadNotes('personsNotes');
    loadNotes('movementsNotes');
    loadNotes('mindmapNotes');
    loadNotes('resourcesNotes');
}
