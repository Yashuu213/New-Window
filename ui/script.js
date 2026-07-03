// Default fallback icon
const FALLBACK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>`;

// Store global apps for rendering
let globalApps = [];

// --- CLOCK & DATE ---
function updateClock() {
    const now = new Date();
    
    // Time
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const timeEl = document.getElementById('top-time');
    if (timeEl) {
        timeEl.innerHTML = `${hours}:${minutes} <small>${ampm}</small>`;
    }

    // Date
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayName = days[now.getDay()];
    const monthName = months[now.getMonth()];
    const date = now.getDate();
    const year = now.getFullYear();
    const dateEl = document.getElementById('top-date');
    if (dateEl) {
        dateEl.innerText = `${dayName}, ${date} ${monthName} ${year}`;
    }

    // Main Clock Widget (if exists)
    const mainTime = document.getElementById('main-time');
    const mainAmpm = document.getElementById('main-ampm');
    const mainDate = document.getElementById('main-date');
    if (mainTime) mainTime.innerText = `${hours}:${minutes}`;
    if (mainAmpm) mainAmpm.innerText = ampm;
    if (mainDate) mainDate.innerText = `${dayName}, ${date} ${monthName} ${year}`;
    
    // Analog Clock
    const hourHand = document.getElementById('hour-hand');
    const minHand = document.getElementById('min-hand');
    const secHand = document.getElementById('sec-hand');
    
    if (hourHand && minHand && secHand) {
        const h = now.getHours();
        const m = now.getMinutes();
        const s = now.getSeconds();
        
        const hDeg = (h % 12) * 30 + m * 0.5;
        const mDeg = m * 6 + s * 0.1;
        const sDeg = s * 6;
        
        hourHand.style.transform = `translate(-50%, -100%) rotate(${hDeg}deg)`;
        minHand.style.transform = `translate(-50%, -100%) rotate(${mDeg}deg)`;
        secHand.style.transform = `translate(-50%, -100%) rotate(${sDeg}deg)`;
    }
}
setInterval(updateClock, 1000);
updateClock();

// --- CALENDAR WIDGET (Basic Dynamic update) ---
function updateCalendarWidget() {
    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const el = document.getElementById('cal-month-year');
    if (el) {
        el.innerText = `${months[now.getMonth()]} ${now.getFullYear()}`;
    }
}
updateCalendarWidget();

// --- APP RENDERING ---
function renderApps(apps) {
    globalApps = apps;
    const drawerGrid = document.getElementById('app-drawer-grid');
    const quickLaunchGrid = document.getElementById('quick-launch-grid');
    
    if (drawerGrid) drawerGrid.innerHTML = '';
    
    // Pick the first 7 apps for quick launch (plus the "Add" button)
    const quickApps = apps.slice(0, 7);
    let qlHtml = '';
    quickApps.forEach(app => {
        let iconHtml = '';
        if (app.icon === "fallback" || !app.icon) {
            iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>`;
        } else {
            iconHtml = `<img src="${app.icon}" onerror="this.outerHTML='${FALLBACK_ICON.replace(/"/g, '&quot;')}'">`;
        }
        qlHtml += `
            <div class="ql-item" onclick="launchApp('${app.target.replace(/\\/g, '\\\\')}')">
                ${iconHtml}
                <span>${app.name}</span>
            </div>
        `;
    });
    qlHtml += `<div class="ql-item"><div class="add-btn">+</div><span>Add</span></div>`;
    if (quickLaunchGrid) quickLaunchGrid.innerHTML = qlHtml;

    // Render all apps in drawer
    apps.forEach(app => {
        const appEl = document.createElement('div');
        appEl.className = 'app-icon';
        
        const box = document.createElement('div');
        box.className = 'icon-box';
        
        if (app.icon === "fallback" || !app.icon) {
            box.innerHTML = FALLBACK_ICON;
        } else {
            const img = document.createElement('img');
            img.src = app.icon;
            img.onerror = function() {
                box.innerHTML = FALLBACK_ICON;
            };
            box.appendChild(img);
        }

        const name = document.createElement('span');
        name.innerText = app.name;
        
        appEl.appendChild(box);
        appEl.appendChild(name);
        
        appEl.onclick = () => {
            launchApp(app.target);
            toggleAppDrawer(false);
        };
        
        if (drawerGrid) drawerGrid.appendChild(appEl);
    });

    // Render right-side app panel
    const rightPanel = document.getElementById('right-app-panel');
    if (rightPanel) {
        rightPanel.innerHTML = '';
        apps.forEach(app => {
            const item = document.createElement('div');
            item.className = 'act-item';
            item.style.cursor = 'pointer';
            item.style.transition = 'transform 0.2s';
            item.onmouseenter = () => item.style.transform = 'translateX(5px)';
            item.onmouseleave = () => item.style.transform = 'translateX(0)';
            item.onclick = () => launchApp(app.target);

            let iconHtml = '';
            if (app.icon === "fallback" || !app.icon) {
                iconHtml = `<div class="act-icon" style="background: rgba(255,255,255,0.1); padding: 5px;">${FALLBACK_ICON}</div>`;
            } else {
                iconHtml = `<img src="${app.icon}" style="width: 32px; height: 32px; border-radius: 6px; object-fit: contain;" onerror="this.outerHTML='<div class=\\'act-icon\\' style=\\'background: rgba(255,255,255,0.1); padding: 5px;\\'>${FALLBACK_ICON.replace(/"/g, '&quot;')}</div>'">`;
            }

            item.innerHTML = `
                ${iconHtml}
                <div class="act-info" style="margin-left: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                    <span class="a-title" style="font-size: 0.9rem;">${app.name}</span>
                </div>
            `;
            rightPanel.appendChild(item);
        });
    }

    renderTaskbar(apps);
}

function renderTaskbar(apps) {
    const tbContainer = document.getElementById('tb-apps-container');
    if (!tbContainer) return;
    tbContainer.innerHTML = '';
    
    // Render first 4 apps as pinned taskbar apps
    const taskbarApps = apps.slice(0, 4);
    taskbarApps.forEach((app, index) => {
        const tbApp = document.createElement('div');
        tbApp.className = 'tb-app';
        if (index === 0) tbApp.classList.add('active'); // mock active state
        
        if (app.icon === "fallback" || !app.icon) {
            tbApp.innerHTML = FALLBACK_ICON;
        } else {
            const img = document.createElement('img');
            img.src = app.icon;
            img.onerror = function() {
                tbApp.innerHTML = FALLBACK_ICON;
            };
            tbApp.appendChild(img);
        }
        
        tbApp.onclick = () => launchApp(app.target);
        tbContainer.appendChild(tbApp);
    });
}

function launchApp(target) {
    console.log("LAUNCH:" + target);
}

function launchSys(cmd) {
    console.log("LAUNCH_SYS:" + cmd);
}


// --- START MENU / APP DRAWER ---
const startBtn = document.getElementById('start-btn');
const appDrawer = document.getElementById('app-drawer');

function toggleAppDrawer(force) {
    if (force !== undefined) {
        if (force) appDrawer.classList.add('show');
        else appDrawer.classList.remove('show');
    } else {
        appDrawer.classList.toggle('show');
    }
}

startBtn?.addEventListener('click', () => toggleAppDrawer());
appDrawer?.addEventListener('click', (e) => {
    if (e.target === appDrawer) toggleAppDrawer(false);
});


// --- POWER MENU POPOVER ---
const btnPower = document.getElementById('btn-power');
const powerMenu = document.getElementById('power-menu');

btnPower?.addEventListener('click', (e) => {
    e.stopPropagation();
    powerMenu?.classList.toggle('show');
});

document.addEventListener('click', (e) => {
    if (powerMenu && powerMenu.classList.contains('show') && !btnPower.contains(e.target)) {
        powerMenu.classList.remove('show');
    }
});

document.getElementById('pm-shutdown')?.addEventListener('click', () => {
    console.log("QUIT");
    powerMenu.classList.remove('show');
});
document.getElementById('pm-restart')?.addEventListener('click', () => {
    console.log("RESTART");
    powerMenu.classList.remove('show');
});
document.getElementById('pm-sleep')?.addEventListener('click', () => {
    console.log("SLEEP");
    powerMenu.classList.remove('show');
});


// The Python backend is expected to inject a call like:
// window.renderApps([...]) when it loads.
