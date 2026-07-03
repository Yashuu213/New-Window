const FALLBACK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>`;

let globalApps = [];
let globalDesktopFiles = [];

window.renderApps = function(apps) {
    globalApps = apps;
};

window.renderDesktopFiles = function(files) {
    globalDesktopFiles = files;
};

window.renderWallpapers = function(wallpapers) {
    // Unused in spotlight, but needed to prevent errors from backend
};

const input = document.getElementById('spotlight-input');
const resultsContainer = document.getElementById('spotlight-results');

input.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (!query) {
        resultsContainer.style.display = 'none';
        return;
    }
    
    const matchedApps = globalApps.filter(app => app.name.toLowerCase().includes(query)).map(app => ({
        name: app.name,
        target: app.target || app.path,
        icon: app.icon === "fallback" || !app.icon ? FALLBACK_ICON : `<img src="${app.icon}" width="28" height="28" style="object-fit: contain;">`,
        type: 'App'
    }));
    
    const matchedFiles = globalDesktopFiles.filter(f => f.name.toLowerCase().includes(query)).map(f => ({
        name: f.name,
        target: f.path,
        icon: f.is_dir ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="28" height="28" stroke-width="2" color="var(--accent)"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="28" height="28" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`,
        type: f.is_dir ? 'Folder' : 'File'
    }));
    
    const results = [...matchedApps, ...matchedFiles].slice(0, 10);
    
    if (results.length > 0) {
        resultsContainer.innerHTML = results.map(r => `
            <div class="s-result-item" onclick="launchTarget('${r.target.replace(/\\/g, '\\\\')}')">
                <div class="s-result-icon">
                    ${r.icon}
                </div>
                <div class="s-result-info">
                    <span class="s-result-title">${r.name}</span>
                    <span class="s-result-desc">${r.type}</span>
                </div>
            </div>
        `).join('');
        resultsContainer.style.display = 'block';
    } else {
        resultsContainer.style.display = 'none';
    }
});

function launchTarget(target) {
    console.log("LAUNCH:" + target);
    // Tell python backend to hide the spotlight window
    console.log("HIDE_SPOTLIGHT");
    
    // Clear the search bar and results for next time
    input.value = '';
    resultsContainer.style.display = 'none';
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        console.log("HIDE_SPOTLIGHT");
        input.value = '';
        resultsContainer.style.display = 'none';
    }
});

// Auto-focus input when the window gets shown
window.addEventListener('focus', () => {
    input.focus();
    input.select();
});

// Set initial focus
input.focus();
