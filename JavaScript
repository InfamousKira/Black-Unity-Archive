// --- Global Variables ---
let archiveData = []; // This will hold all the data loaded from data.json

// --- Core Initialization Function ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Data and Build Interface
    loadDataAndBuildInterface();
    // 2. Load User Notes (using localStorage)
    loadAllNotes();
    // 3. Show the initial Home section
    showSection('home');
});

// --- Data Loading and Interface Builder ---
async function loadDataAndBuildInterface() {
    try {
        const response = await fetch('data.json');
        archiveData = await response.json();
        
        // 1. Build Section Grids (Persons, Movements)
        renderContentGrids(archiveData);

        // 2. Set Daily Review Entry
        renderDailyReview();

        // 3. Build Timeline
        renderTimeline(archiveData);
        
        // 4. Build Mind Map (this function runs on click to save resources)
        // renderMindMap(archiveData);

    } catch (error) {
        console.error('Error loading or parsing data.json:', error);
        document.querySelector('main').innerHTML = '<p style="color: red;">Error loading archive data. Please check the data.json file path and format.</p>';
    }
}

// --- Navigation and Section Management ---
function showSection(sectionId) {
    // Hide all sections first
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

    // Special behavior for Mind Map (build it only when the tab is clicked)
    if (sectionId === 'mindmap' && !document.getElementById('mindmapContainer').hasChildNodes()) {
        renderMindMap(archiveData);
    }
}

function hideDetailPage() {
    document.getElementById('detailPage').classList.add('hidden');
    // Re-show the last active list section (e.g., 'persons' or 'movements')
    const lastSection = localStorage.getItem('lastActiveListSection') || 'home';
    showSection(lastSection);
}


// --- Content Rendering Functions ---

function renderDailyReview() {
    const dailyReviewEl = document.getElementById('dailyReviewContent');
    if (!archiveData.length) return;

    // Use a date-based index to make sure it's consistent for the whole day
    const day = new Date();
    const index = Math.floor(day.getTime() / (1000 * 60 * 60 * 24)) % archiveData.length;
    const item = archiveData[index];

    dailyReviewEl.innerHTML = `
        <h3>${item.name} (${item.type})</h3>
        <p><strong>Period:</strong> ${item.dates}</p>
        <p>${item.summary}</p>
        <button onclick="showDetail('${item.id}', 'home')">Learn More</button>
    `;
}

function renderContentGrids(data) {
    const personsGrid = document.getElementById('personsGrid');
    const movementsGrid = document.getElementById('movementsGrid');
    
    personsGrid.innerHTML = '';
    movementsGrid.innerHTML = '';

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'content-card';
        card.innerHTML = `
            <h3 class="card-title" onclick="showDetail('${item.id}', '${item.type === 'Person' ? 'persons' : 'movements'}')">${item.name}</h3>
            <p><strong>Key Terms:</strong> ${item.key_terms.join(', ')}</p>
        `;
        
        if (item.type === 'Person') {
            personsGrid.appendChild(card);
        } else if (item.type === 'Movement' || item.type === 'Event') {
            movementsGrid.appendChild(card);
        }
    });
}

function showDetail(id, lastSection) {
    const item = archiveData.find(d => d.id === id);
    if (!item) return;

    // Hide all list sections and show the detail page
    document.querySelectorAll('section').forEach(section => section.classList.add('hidden'));
    document.getElementById('detailPage').classList.remove('hidden');

    // Store which section we came from to go back correctly
    localStorage.setItem('lastActiveListSection', lastSection);

    // Populate detail page content
    document.getElementById('detailTitle').textContent = item.name;
    document.getElementById('detailDates').textContent = `Period: ${item.dates}`;
    document.getElementById('detailContent').innerHTML = item.detail;

    // Populate sources
    const sourcesList = document.getElementById('detailSources');
    sourcesList.innerHTML = item.sources.map(src => `<li>${src}</li>`).join('');

    // Load and save detail notes
    document.getElementById('detailNotes').id = `notes-${item.id}`; // Give it a unique ID for storage
    loadNotes(`notes-${item.id}`); 
    document.getElementById('detailNotes').onkeyup = () => saveNotes(`notes-${item.id}`);
}


// --- Search Functionality ---

function filterContent() {
    const input = document.getElementById('searchInput');
    const filter = input.value.toUpperCase();

    // If search is empty, re-render everything
    if (filter.trim() === '') {
        renderContentGrids(archiveData);
        return;
    }

    const filteredData = archiveData.filter(item => {
        const nameMatch = item.name.toUpperCase().includes(filter);
        const summaryMatch = item.summary.toUpperCase().includes(filter);
        const keyTermsMatch = item.key_terms.some(term => term.toUpperCase().includes(filter));
        
        return nameMatch || summaryMatch || keyTermsMatch;
    });

    renderContentGrids(filteredData);
    // Force the view to the Persons tab as it shows all filtered results
    showSection('persons');
}


// --- Timeline Rendering ---

function renderTimeline(data) {
    const timelineEl = document.getElementById('timelineContainer');
    timelineEl.innerHTML = '';

    // Simple sorting by the start date (assuming the dates field starts with a year)
    const sortedData = [...data].sort((a, b) => {
        const yearA = parseInt(a.dates.split('-')[0]);
        const yearB = parseInt(b.dates.split('-')[0]);
        return yearA - yearB;
    });

    sortedData.forEach(item => {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'timeline-event';
        eventDiv.innerHTML = `
            <h4>${item.dates}</h4>
            <p><strong class="card-title" onclick="showDetail('${item.id}', 'timeline')">${item.name}</strong> (${item.type})</p>
        `;
        timelineEl.appendChild(eventDiv);
    });
}


// --- Mind Map (Vis.js Network) Rendering ---
function renderMindMap(data) {
    const nodes = [];
    const edges = [];
    const colorMap = {
        'Person': '#A0522D', // Primary Color
        'Movement': '#DAA520', // Accent Color
        'Event': '#F8F8FF' // Secondary Color
    };

    // 1. Create Nodes
    data.forEach(item => {
        nodes.push({
            id: item.id,
            label: item.name,
            title: item.summary,
            color: colorMap[item.type] || '#778899', // Default color if type is missing
            shape: item.type === 'Person' ? 'dot' : 'box'
        });
    });

    // 2. Create Edges (Connections)
    data.forEach(sourceItem => {
        if (sourceItem.connections && Array.isArray(sourceItem.connections)) {
            sourceItem.connections.forEach(targetName => {
                const targetItem = data.find(item => item.name === targetName);
                if (targetItem) {
                    edges.push({
                        from: sourceItem.id,
                        to: targetItem.id,
                        arrows: 'to',
                        title: `${sourceItem.name} connected to ${targetItem.name}`
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
        layout: {
            hierarchical: {
                enabled: false // Disable hierarchical layout for a more natural mind map look
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 100
        },
        physics: {
            enabled: true,
            // Configure repulsion or force-atlas for an organic look
            solver: 'forceAtlas2Based',
            forceAtlas2Based: {
                gravitationalConstant: -100,
                springConstant: 0.08
            }
        }
    };

    new vis.Network(container, networkData, options);
    // 
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
    // Note: Detail page notes are loaded dynamically in showDetail()
}
