let pinnedApps = JSON.parse(localStorage.getItem('pinnedApps')) || [];
function savePinnedApps() {
    localStorage.setItem('pinnedApps', JSON.stringify(pinnedApps));
}

function renderBottomDock() {
    const bottomApps = document.getElementById('bottom-apps');
    if (!bottomApps || !window.allApps) return;
    bottomApps.innerHTML = '';
    
    const openWindows = window.currentOpenWindows || [];
    const runningTargets = openWindows.map(w => w.path ? w.path.toLowerCase() : "");
    const itemsToRender = [];
    
    const targetToApp = {};
    window.allApps.forEach(app => {
        if (app.target) {
            targetToApp[app.target.toLowerCase()] = app;
        }
    });
    
    // Add pinned apps first
    window.allApps.forEach(app => {
        if (pinnedApps.includes(app.path)) {
            const isRunning = app.target && runningTargets.includes(app.target.toLowerCase());
            const hwnds = openWindows.filter(w => w.path && app.target && w.path.toLowerCase() === app.target.toLowerCase()).map(w => w.hwnd);
            
            itemsToRender.push({
                type: 'pinned',
                app: app,
                isRunning: isRunning,
                hwnds: hwnds
            });
        }
    });
    
    // Add running apps that are not pinned
    const pinnedTargets = itemsToRender.map(item => item.app.target ? item.app.target.toLowerCase() : "");
    
    openWindows.forEach(win => {
        if (!win.path) return;
        const winPathLower = win.path.toLowerCase();
        if (pinnedTargets.includes(winPathLower)) return;
        
        let appObj = targetToApp[winPathLower];
        if (!appObj) {
            // Robust fuzzy match by executable name
            const exeName = winPathLower.split('\\').pop().replace('.exe', '');
            if (exeName && window.allApps) {
                appObj = window.allApps.find(a => {
                    const nameLower = a.name.toLowerCase();
                    const targetLower = a.target ? a.target.toLowerCase() : '';
                    if (targetLower.includes(exeName)) return true;
                    if (nameLower.includes(exeName)) return true;
                    if (nameLower === exeName) return true;
                    // For things like WhatsAppDesktop
                    if (targetLower.includes(exeName.replace(' ', ''))) return true;
                    return false;
                });
            }
        }
        
        if (!appObj) {
            appObj = {
                name: win.title.split(' - ').pop() || win.title,
                path: win.path,
                target: win.path,
                icon: 'fallback'
            };
        }
        
        const alreadyAdded = itemsToRender.some(item => item.app.target && item.app.target.toLowerCase() === winPathLower);
        if (alreadyAdded) {
            const existing = itemsToRender.find(item => item.app.target && item.app.target.toLowerCase() === winPathLower);
            if (existing) {
                existing.hwnds.push(win.hwnd);
            }
        } else {
            itemsToRender.push({
                type: 'running',
                app: appObj,
                isRunning: true,
                hwnds: [win.hwnd]
            });
        }
    });
    
    // Render the final set
    itemsToRender.forEach((item) => {
        const app = item.app;
        const bottomItem = document.createElement('div');
        bottomItem.className = 'bottom-dock-item';
        bottomItem.title = app.name;
        bottomItem.style.position = 'relative';
        
        if (app.icon === "fallback" || !app.icon) {
            bottomItem.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8" style="width:28px; height:28px;"><rect x="3" y="3" width="18" height="18" rx="4"></rect><path d="M3 9h18M9 21V9"></path></svg>`;
        } else {
            const img = document.createElement('img');
            img.src = app.icon;
            img.style.width = '28px';
            bottomItem.appendChild(img);
        }
        
        if (item.isRunning) {
            const pill = document.createElement('div');
            pill.style.position = 'absolute';
            pill.style.bottom = '2px';
            pill.style.left = '50%';
            pill.style.transform = 'translateX(-50%)';
            pill.style.width = '6px';
            pill.style.height = '6px';
            pill.style.background = 'var(--accent)';
            pill.style.borderRadius = '50%';
            pill.style.boxShadow = '0 0 8px var(--accent)';
            bottomItem.appendChild(pill);
        }
        
        bottomItem.addEventListener('click', () => {
            if (item.isRunning && item.hwnds.length > 0) {
                console.log("FOCUS:" + item.hwnds[0]);
            } else {
                console.log("LAUNCH:" + app.path);
            }
        });
        
        bottomItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showAppContextMenu(e.clientX, e.clientY, app);
        });
        
        bottomApps.appendChild(bottomItem);
    });
}

let selectedApp = null;
function showAppContextMenu(x, y, app) {
    selectedApp = app;
    const menu = document.getElementById('app-context-menu');
    if (!menu) return;
    const isPinned = pinnedApps.includes(app.path);
    document.getElementById('pin-text').textContent = isPinned ? "Unpin from Taskbar" : "Pin to Taskbar";
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.add('show');
}

// Global functions to be called by Python injection
window.renderApps = function(apps) {
    // We are no longer populating the right mac-dock. 
    // We populate the App Drawer instead.
    const appDrawerGrid = document.getElementById('app-drawer-grid');
    if (!appDrawerGrid) return;
    
    // Store globally for spotlight search
    window.allApps = apps;
    
    appDrawerGrid.innerHTML = '';
    
    apps.forEach((app, index) => {
        const item = document.createElement('div');
        item.className = 'app-icon'; // Reuse desktop app icon style or create new one
        item.style.animationDelay = `${(index % 20) * 0.05}s`;
        item.style.animation = 'slideInUp 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) forwards';
        item.style.opacity = '0'; // for animation
        
        const box = document.createElement('div');
        box.className = 'icon-box';
        
        if (app.icon === "fallback" || !app.icon) {
            box.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px; height:24px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>`;
        } else {
            const img = document.createElement('img');
            img.src = app.icon;
            img.style.width = '32px';
            img.style.height = '32px';
            box.appendChild(img);
        }
        
        const label = document.createElement('span');
        label.textContent = app.name;
        
        item.appendChild(box);
        item.appendChild(label);
        
        item.addEventListener('click', () => {
            console.log("LAUNCH:" + app.path);
            document.getElementById('app-drawer').classList.remove('show'); // close on launch
        });
        
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showAppContextMenu(e.clientX, e.clientY, app);
        });
        
        appDrawerGrid.appendChild(item);
    });

    // Initialize pinned apps from localStorage on first-time load
    const isInitialized = localStorage.getItem('pinnedAppsInitialized');
    if (!isInitialized && apps.length > 0) {
        pinnedApps = apps.slice(0, 4).map(a => a.path);
        savePinnedApps();
        localStorage.setItem('pinnedAppsInitialized', 'true');
    }
    renderBottomDock();

    // Populate Right Mac-Style Dock
    const dynamicDock = document.getElementById('dynamic-dock');
    const divider = document.getElementById('dock-divider');
    if (dynamicDock && divider) {
        // Keep divider, clear the rest
        Array.from(dynamicDock.children).forEach(child => {
            if (child.id !== 'dock-divider') {
                child.remove();
            }
        });
        
        apps.forEach((app, index) => {
            const item = document.createElement('div');
            item.className = 'dock-item';
            item.title = app.name;
            item.style.animationDelay = `${(index % 20) * 0.05}s`;
            
            if (app.icon === "fallback" || !app.icon) {
                item.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8" style="width:28px; height:28px;"><rect x="3" y="3" width="18" height="18" rx="4"></rect><path d="M3 9h18M9 21V9"></path></svg>`;
            } else {
                const img = document.createElement('img');
                img.src = app.icon;
                item.appendChild(img);
            }
            item.addEventListener('click', () => {
                console.log("LAUNCH:" + app.path);
            });
            
            dynamicDock.insertBefore(item, divider);
        });
    }
};

    window.renderWallpapers = function(wallpapers) {
        if (wallpapers.length > 0) {
            let currentIndex = 0;
            const layer1 = document.getElementById('bg-layer-1');
            const layer2 = document.getElementById('bg-layer-2');
            let activeLayer = 1;
            
            layer1.style.backgroundImage = `url('${wallpapers[0]}')`;
            
            if (wallpapers.length > 1) {
                setInterval(() => {
                    currentIndex = (currentIndex + 1) % wallpapers.length;
                    const nextImg = `url('${wallpapers[currentIndex]}')`;
                    
                    if (activeLayer === 1) {
                        layer2.style.backgroundImage = nextImg;
                        layer2.style.opacity = 1;
                        layer1.style.opacity = 0;
                        activeLayer = 2;
                    } else {
                        layer1.style.backgroundImage = nextImg;
                        layer1.style.opacity = 1;
                        layer2.style.opacity = 0;
                        activeLayer = 1;
                    }
                }, 15000);
            }
        }
    };

    window.renderOpenWindows = function(windows) {
        window.currentOpenWindows = windows;
        renderBottomDock();
        
        const container = document.getElementById('open-windows-tabs');
        if (!container) return;
        
        container.innerHTML = '';
        windows.forEach((win, index) => {
            const tab = document.createElement('div');
            tab.className = 'window-tab';
            tab.textContent = (index + 1).toString();
            tab.title = win.title;
            
            tab.addEventListener('click', () => {
                console.log("FOCUS:" + win.hwnd);
            });
            
            container.appendChild(tab);
        });
    };

    window.renderDesktopFiles = function(files) {
        const loading = document.getElementById('files-loading');
        if (loading) loading.remove();
        
        const grid = document.getElementById('desktop-files-grid');
        
        files.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.title = file.name;
            item.style.animation = `slideInUp 0.5s cubic-bezier(0.25, 0.8, 0.25, 1) ${index * 0.05}s forwards`;
            item.style.opacity = '0';
            
            let iconSvg = '';
            if (file.is_dir) {
                iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
            } else {
                iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
            }
            
            item.innerHTML = `
                ${iconSvg}
                <span>${file.name}</span>
            `;
            
            item.addEventListener('click', () => {
                console.log("LAUNCH:" + file.path);
            });
            
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.showFileContextMenu) {
                    window.showFileContextMenu(e.clientX, e.clientY, file);
                }
            });
            
            grid.appendChild(item);
        });
    };

    // --- CLOCK WIDGET LOGIC ---
    function updateClock() {
        const now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes;
        
        const timeElement = document.getElementById('clock-time');
        if (timeElement) {
            timeElement.textContent = `${hours}:${minutes} ${ampm}`;
        }
        
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        const dateElement = document.getElementById('clock-date');
        if (dateElement) {
            dateElement.textContent = now.toLocaleDateString('en-US', options);
        }
    }
    
    // Update immediately and then every second
    updateClock();
    setInterval(updateClock, 1000);

    // --- INDIVIDUAL TRAY POPOVERS ---
    const trayButtons = ['wifi', 'hotspot', 'vol', 'bright', 'more'];
    
    trayButtons.forEach(id => {
        const btn = document.getElementById(`btn-${id}`);
        const pop = document.getElementById(`pop-${id}`);
        
        if (btn && pop) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Close all other popovers
                document.querySelectorAll('.tray-popover.show').forEach(p => {
                    if (p !== pop) p.classList.remove('show');
                });
                
                // Toggle clicked popover
                pop.classList.toggle('show');
            });
        }
    });

    // --- TOGGLE DESKTOP FILES ---
    const btnToggleFiles = document.getElementById('btn-toggle-files');
    const leftDockContainer = document.querySelector('.left-dock-container');
    if (btnToggleFiles && leftDockContainer) {
        btnToggleFiles.addEventListener('click', (e) => {
            e.stopPropagation();
            if (leftDockContainer.style.display === 'none') {
                leftDockContainer.style.display = 'block';
            } else {
                leftDockContainer.style.display = 'none';
            }
        });
    }

    // Close all popovers if clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.tray-popover') && !e.target.closest('.tray-icon-btn')) {
            document.querySelectorAll('.tray-popover.show').forEach(p => {
                p.classList.remove('show');
            });
        }
    });

    // --- POWER BUTTON LOGIC ---
    const btnPower = document.getElementById('btn-power');
    const powerMenu = document.getElementById('power-menu');

    btnPower?.addEventListener('click', (e) => {
        e.stopPropagation();
        powerMenu?.classList.toggle('show');
    });

    document.getElementById('pm-sleep')?.addEventListener('click', () => {
        console.log("SLEEP");
    });
    
    document.getElementById('pm-shutdown')?.addEventListener('click', () => {
        console.log("SHUTDOWN");
    });
    
    document.getElementById('pm-restart')?.addEventListener('click', () => {
        console.log("RESTART");
    });

    // Close power menu when clicking outside
    document.addEventListener('click', (e) => {
        if(powerMenu && powerMenu.classList.contains('show') && !powerMenu.contains(e.target) && e.target !== btnPower && !btnPower.contains(e.target)) {
            powerMenu.classList.remove('show');
        }
    });

    // --- CUSTOM CONTEXT MENU ---
    const contextMenu = document.getElementById('custom-context-menu');
    document.addEventListener('contextmenu', (e) => {
        // Prevent default only on the desktop background, not in input fields
        if(e.target.tagName !== 'INPUT') {
            e.preventDefault();
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.style.top = `${e.clientY}px`;
            contextMenu.classList.add('show');
        }
    });
    
    document.addEventListener('click', (e) => {
        if(contextMenu.classList.contains('show')) {
            contextMenu.classList.remove('show');
        }
    });

    document.getElementById('cm-refresh')?.addEventListener('click', () => {
        console.log("JS: Refreshing...");
        location.reload();
    });

    // --- APP DRAWER (START MENU) ---
    const startBtn = document.getElementById('start-btn');
    const appDrawer = document.getElementById('app-drawer');
    
    startBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        appDrawer.classList.toggle('show');
    });

    appDrawer?.addEventListener('click', (e) => {
        // Close if clicking the blurred background (not the grid itself)
        if(e.target === appDrawer || e.target.classList.contains('app-drawer-content')) {
            appDrawer.classList.remove('show');
        }
    });

    // --- NOTIFICATION CENTER ---
    const notifBtn = document.getElementById('notif-btn');
    const notifCenter = document.getElementById('notification-center');
    const notifClear = document.getElementById('notif-clear');
    const notifList = document.getElementById('notif-list');
    const notifDot = document.getElementById('notif-dot');

    notifBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        notifCenter.classList.toggle('show');
    });

    notifClear?.addEventListener('click', () => {
        if(notifList) notifList.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">No new notifications</div>';
        if(notifDot) notifDot.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
        if(notifCenter && notifCenter.classList.contains('show')) {
            if(!notifCenter.contains(e.target) && e.target !== notifBtn && !notifBtn.contains(e.target)) {
                notifCenter.classList.remove('show');
            }
        }
    });

    // --- SPOTLIGHT SEARCH ---
    const spotlightOverlay = document.getElementById('spotlight-overlay');
    const spotlightInput = document.getElementById('spotlight-input');
    const spotlightResults = document.getElementById('spotlight-results');

    // JS hotkey for Alt+Space (when UI has focus)
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.code === 'Space') {
            e.preventDefault();
            toggleSpotlight();
        }
        if (e.code === 'Escape') {
            spotlightOverlay.classList.remove('show');
            appDrawer.classList.remove('show');
        }
    });

    function toggleSpotlight() {
        if (spotlightOverlay.classList.contains('show')) {
            spotlightOverlay.classList.remove('show');
        } else {
            spotlightOverlay.classList.add('show');
            spotlightInput.value = '';
            spotlightResults.innerHTML = '';
            setTimeout(() => spotlightInput.focus(), 100);
        }
    }

    spotlightOverlay?.addEventListener('click', (e) => {
        if(e.target === spotlightOverlay) {
            spotlightOverlay.classList.remove('show');
        }
    });

    spotlightInput?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        spotlightResults.innerHTML = '';
        if(query.trim() === '') return;
        
        if(window.allApps) {
            const matches = window.allApps.filter(a => a.name.toLowerCase().includes(query)).slice(0, 5);
            matches.forEach(app => {
                const item = document.createElement('div');
                item.className = 'pop-item'; // Reuse pop-item style for search results
                item.style.padding = '15px';
                item.style.marginBottom = '5px';
                
                const img = document.createElement('img');
                img.src = app.icon;
                img.style.width = '24px';
                img.style.marginRight = '10px';
                
                const txt = document.createElement('div');
                txt.textContent = app.name;
                
                item.appendChild(img);
                item.appendChild(txt);
                
                item.addEventListener('click', () => {
                    console.log("LAUNCH:" + app.path);
                    spotlightOverlay.classList.remove('show');
                });
                
                spotlightResults.appendChild(item);
            });
        }
    });


    // --- SYSTEM SETTINGS PANEL LOGIC ---
    const settingsBtn = document.querySelector('.settings-icon');
    const settingsOverlay = document.getElementById('settings-overlay');
    const closeSettings = document.getElementById('close-settings');
    
    if (settingsBtn && settingsOverlay) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close Control Center popover
            document.getElementById('pop-more')?.classList.remove('show');
            settingsOverlay.classList.add('show');
        });
    }
    
    if (closeSettings && settingsOverlay) {
        closeSettings.addEventListener('click', () => {
            settingsOverlay.classList.remove('show');
        });
    }
    
    // Color Accent Swatches
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            swatches.forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            
            const color = swatch.getAttribute('data-color');
            const glow = swatch.getAttribute('data-glow');
            
            document.documentElement.style.setProperty('--accent', color);
            document.documentElement.style.setProperty('--accent-glow', glow);
            
            console.log(`SET_ACCENT:${color},${glow}`);
        });
    });

    // --- CONTROL CENTER BUTTON TOGGLES ---
    document.querySelectorAll('.cc-btn-simple, .cc-btn-group').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (btn.classList.contains('disabled')) return;
            btn.classList.toggle('active');
            const label = btn.closest('.cc-item')?.querySelector('.cc-label')?.textContent;
            
            // Handle Dark Mode toggle theme swap
            if (label === 'Dark Mode') {
                const isActive = btn.classList.contains('active');
                if (isActive) {
                    document.documentElement.style.setProperty('--glass-bg', 'rgba(15, 15, 20, 0.6)');
                    document.documentElement.style.setProperty('--text-primary', '#f8fafc');
                    document.documentElement.style.setProperty('--text-secondary', '#94a3b8');
                    document.body.style.background = '#000';
                } else {
                    document.documentElement.style.setProperty('--glass-bg', 'rgba(240, 240, 245, 0.6)');
                    document.documentElement.style.setProperty('--text-primary', '#0f172a');
                    document.documentElement.style.setProperty('--text-secondary', '#475569');
                    document.body.style.background = '#f1f5f9';
                }
            }
            
            console.log(`TOGGLE_OPTION:${label}:${btn.classList.contains('active')}`);
        });
    });

    // --- VOLUME & BRIGHTNESS SLIDERS (Redesigned for macOS Control Center) ---
    const volSlider = document.getElementById('cc-volume-slider');
    const brightSlider = document.getElementById('cc-brightness-slider');
    const overlay = document.getElementById('brightness-overlay');
    
    volSlider?.addEventListener('input', (e) => {
        const val = e.target.value;
        console.log(`SET_VOLUME:${val}`);
    });
    
    brightSlider?.addEventListener('input', (e) => {
        const val = e.target.value;
        console.log(`SET_BRIGHTNESS:${val}`);
        if(overlay) {
            overlay.style.opacity = ((100 - val) / 150.0).toString();
        }
    });

    // Mirror individual tray sliders to Control Center sliders
    const individualVolSlider = document.querySelector('#pop-vol .horizontal-slider');
    const individualBrightSlider = document.querySelector('#pop-bright .horizontal-slider');
    
    individualVolSlider?.addEventListener('input', (e) => {
        const val = e.target.value;
        if(volSlider) volSlider.value = val;
        console.log(`SET_VOLUME:${val}`);
    });

    individualBrightSlider?.addEventListener('input', (e) => {
        const val = e.target.value;
        if(brightSlider) brightSlider.value = val;
        console.log(`SET_BRIGHTNESS:${val}`);
        if(overlay) {
            overlay.style.opacity = ((100 - val) / 150.0).toString();
        }
    });

    
    // --- MAC-STYLE CONTROL CENTER INTERACTIVITY ---
    // Wi-Fi toggle (Clicking icon toggles Wi-Fi state)
    document.getElementById('cc-wifi-icon')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const icon = document.getElementById('cc-wifi-icon');
        const isActive = icon.classList.toggle('active');
        console.log(`TOGGLE_OPTION:Wi-Fi:${isActive}`);
    });
    
    // Wi-Fi Details Trigger (Clicking text or arrow opens Wi-Fi connections popover)
    document.getElementById('cc-wifi-toggle')?.addEventListener('click', (e) => {
        if (e.target.closest('#cc-wifi-icon')) return; // Avoid triggering twice if icon clicked
        e.stopPropagation();
        
        // Hide control center, open wifi connections popover
        document.getElementById('pop-more')?.classList.remove('show');
        document.getElementById('pop-wifi')?.classList.add('show');
    });

    // Bluetooth Toggle
    document.getElementById('cc-bluetooth-toggle')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const icon = document.getElementById('cc-bluetooth-icon');
        const status = document.getElementById('cc-bluetooth-status');
        const isActive = icon.classList.toggle('active');
        if (status) status.textContent = isActive ? "On" : "Off";
        console.log(`TOGGLE_OPTION:Bluetooth:${isActive}`);
    });

    // Hotspot Toggle
    document.getElementById('cc-hotspot-toggle')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const icon = document.getElementById('cc-hotspot-icon');
        const status = document.getElementById('cc-hotspot-status');
        const isActive = icon.classList.toggle('active');
        if (status) status.textContent = isActive ? "On" : "Off";
        console.log(`TOGGLE_HOTSPOT:${isActive}`);
    });

    // Focus Toggle
    document.getElementById('cc-focus-toggle')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = document.getElementById('cc-focus-toggle');
        card.classList.toggle('active');
    });

    // Airplane Toggle
    document.getElementById('cc-airplane-toggle')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = document.getElementById('cc-airplane-toggle');
        const isActive = card.classList.toggle('active');
        const status = card.querySelector('.cc-sub');
        if (status) status.textContent = isActive ? "On" : "Off";
        console.log(`TOGGLE_OPTION:Airplane:${isActive}`);
    });

    // Music Player controls
    const npPlay = document.getElementById('np-play');
    npPlay?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isPlaying = npPlay.classList.toggle('playing');
        const icon = document.getElementById('np-play-icon');
        if (icon) {
            icon.innerHTML = isPlaying ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>' : '<polygon points="8 5 8 19 19 12 8 5"></polygon>';
        }
    });

    
    // --- MAC OS STYLE WI-FI SWITCH TOGGLE ---
    document.getElementById('mac-wifi-toggle-checkbox')?.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        console.log(`TOGGLE_OPTION:Wi-Fi:${isChecked}`);
        
        const wifiIcon = document.getElementById('cc-wifi-icon');
        if (wifiIcon) {
            if (isChecked) wifiIcon.classList.add('active');
            else wifiIcon.classList.remove('active');
        }
        // Instantly force a list refresh
        console.log("REFRESH_DESKTOP");
    });

    document.getElementById('mac-wifi-settings-btn')?.addEventListener('click', () => {
        console.log("OPEN_DISPLAY_SETTINGS"); // Redirects to settings
    });

    
    window.renderHotspotConfig = function(config) {
        const popContent = document.getElementById('mac-hotspot-config-content');
        if (!popContent) return;
        
        const toggle = document.getElementById('mac-hotspot-toggle-checkbox');
        if (toggle) {
            toggle.checked = (config.status.toLowerCase() === 'on' || config.status === '1' || config.status === 'Running');
        }
        
        popContent.innerHTML = `
            <div class="mac-wifi-section-title">Hotspot Config</div>
            <div class="mac-wifi-item active">
                <div class="mac-wifi-icon-container">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px; height:14px;"><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>
                </div>
                <div class="cc-text-group">
                    <div class="cc-title">SSID / Name</div>
                    <div class="cc-sub">${config.ssid || 'NexusHotspot'}</div>
                </div>
            </div>
            <div class="mac-wifi-item">
                <div class="mac-wifi-icon-container">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px; height:14px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <div class="cc-text-group">
                    <div class="cc-title">Password</div>
                    <div class="cc-sub">${config.password || 'password123'}</div>
                </div>
            </div>
            <div class="mac-wifi-item">
                <div class="mac-wifi-icon-container">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px; height:14px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </div>
                <div class="cc-text-group">
                    <div class="cc-title">Connected Devices</div>
                    <div class="cc-sub">${config.devices} device(s)</div>
                </div>
            </div>
        `;
        
        const ccHotspotStatus = document.getElementById('cc-hotspot-status');
        const ccHotspotIcon = document.getElementById('cc-hotspot-icon');
        const isRunning = (config.status.toLowerCase() === 'on' || config.status === 'Running');
        
        if (ccHotspotStatus) {
            ccHotspotStatus.textContent = isRunning ? 'On' : 'Off';
        }
        if (ccHotspotIcon) {
            if (isRunning) ccHotspotIcon.classList.add('active');
            else ccHotspotIcon.classList.remove('active');
        }
    };

    window.renderWifiNetworks = function(networks) {
        const listContainer = document.getElementById('mac-wifi-networks-list');
        if (!listContainer) return;
        
        const isWifiOn = document.getElementById('mac-wifi-toggle-checkbox')?.checked;
        if (!isWifiOn) {
            listContainer.innerHTML = '<div style="text-align:center; padding:15px; color:rgba(255,255,255,0.3); font-size:0.8rem;">Wi-Fi is turned off</div>';
            const ccWifiStatus = document.getElementById('cc-wifi-status');
            if (ccWifiStatus) ccWifiStatus.textContent = "Off";
            return;
        }

        listContainer.innerHTML = '';
        const ccWifiStatus = document.getElementById('cc-wifi-status');
        
        if (networks.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; padding:15px; color:rgba(255,255,255,0.4); font-size:0.8rem;">No networks found</div>';
            if (ccWifiStatus) ccWifiStatus.textContent = "Disconnected";
            return;
        }
        
        const connectedNet = networks.find(n => n.status === 'Connected');
        const otherNets = networks.filter(n => n.status !== 'Connected');

        if (ccWifiStatus) {
            ccWifiStatus.textContent = connectedNet ? connectedNet.ssid : "Available";
        }

        // Lock SVG helper
        const lockSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px; height:12px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
        
        // Connected Network Section
        if (connectedNet) {
            const sectionTitle = document.createElement('div');
            sectionTitle.className = 'mac-wifi-section-title';
            sectionTitle.textContent = 'Known Network';
            listContainer.appendChild(sectionTitle);

            const item = document.createElement('div');
            item.className = 'mac-wifi-item active';
            item.innerHTML = `
                <div class="mac-wifi-icon-container">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px; height:14px;"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
                </div>
                <span class="mac-wifi-name">${connectedNet.ssid}</span>
                <span class="mac-wifi-lock">${lockSVG}</span>
            `;
            item.addEventListener('click', () => {
                if (confirm(`Disconnect from ${connectedNet.ssid}?`)) {
                    console.log("DISCONNECT_WIFI:" + connectedNet.ssid);
                }
            });
            listContainer.appendChild(item);
        }

        // Other Networks Section
        if (otherNets.length > 0) {
            const sectionTitle = document.createElement('div');
            sectionTitle.className = 'mac-wifi-section-title';
            sectionTitle.textContent = 'Other Networks';
            listContainer.appendChild(sectionTitle);

            otherNets.forEach(net => {
                const item = document.createElement('div');
                item.className = 'mac-wifi-item';
                item.innerHTML = `
                    <div class="mac-wifi-icon-container">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px; height:14px;"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
                    </div>
                    <span class="mac-wifi-name">${net.ssid}</span>
                    <span class="mac-wifi-lock">${lockSVG}</span>
                `;
                item.addEventListener('click', () => {
                    const password = prompt(`Enter password for ${net.ssid} (Leave empty for open networks):`);
                    if (password !== null) {
                        console.log(`CONNECT_WIFI:${net.ssid}|${password}`);
                    }
                });
                listContainer.appendChild(item);
            });
        }
    };

    // --- TASK VIEW BUTTON ---
    const taskViewBtn = document.getElementById('task-view-btn');
    taskViewBtn?.addEventListener('click', () => {
        console.log("TRIGGER_TASK_VIEW");
    });

    // --- WINDOWS CONTEXT MENU OPERATIONS ---
    document.getElementById('cm-new')?.addEventListener('click', () => {
        const name = prompt("Enter new folder name:", "New Folder");
        if (name) {
            console.log("CREATE_FOLDER:" + name);
        }
    });

    document.getElementById('cm-settings')?.addEventListener('click', () => {
        console.log("OPEN_DISPLAY_SETTINGS");
    });

    document.getElementById('cm-wallpaper')?.addEventListener('click', () => {
        console.log("OPEN_PERSONALIZATION");
    });

    // Make refresh button refresh the desktop files list
    document.getElementById('cm-refresh')?.addEventListener('click', () => {
        console.log("REFRESH_DESKTOP");
    });

    // --- MOBILE HOTSPOT TOGGLE ---
    document.getElementById('mac-hotspot-toggle-checkbox')?.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        console.log("TOGGLE_HOTSPOT:" + isChecked);
        
        // Force refresh scan state in UI
        setTimeout(() => {
            console.log("REFRESH_DESKTOP");
        }, 1500);
    });

    // --- APP CONTEXT MENU OPERATIONS ---
    document.getElementById('cm-pin-taskbar')?.addEventListener('click', () => {
        if (!selectedApp) return;
        const isPinned = pinnedApps.includes(selectedApp.path);
        if (isPinned) {
            pinnedApps = pinnedApps.filter(p => p !== selectedApp.path);
        } else {
            pinnedApps.push(selectedApp.path);
        }
        savePinnedApps();
        renderBottomDock();
        document.getElementById('app-context-menu')?.classList.remove('show');
    });

    document.addEventListener('click', () => {
        document.getElementById('app-context-menu')?.classList.remove('show');
    });

// ============================================
// DESKTOP FILE CONTEXT MENU & FILE OPERATIONS
// ============================================
(function initFileContextMenu() {
    // Create context menu element
    const menu = document.createElement('div');
    menu.className = 'file-context-menu';
    menu.id = 'file-context-menu';
    menu.innerHTML = `
        <div class="file-ctx-item" id="fctx-open">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
            Open
        </div>
        <div class="file-ctx-divider"></div>
        <div class="file-ctx-item" id="fctx-rename">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            Rename
        </div>
        <div class="file-ctx-item" id="fctx-copy">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy Path
        </div>
        <div class="file-ctx-item" id="fctx-properties">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Properties
        </div>
        <div class="file-ctx-divider"></div>
        <div class="file-ctx-item danger" id="fctx-delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Delete
        </div>
    `;
    document.body.appendChild(menu);

    let selectedFile = null;

    window.showFileContextMenu = function(x, y, fileData) {
        selectedFile = fileData;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.add('show');
    };

    // Close on click outside
    document.addEventListener('click', () => {
        menu.classList.remove('show');
    });

    // Open file
    document.getElementById('fctx-open')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectedFile) {
            console.log("LAUNCH:" + selectedFile.path);
        }
        menu.classList.remove('show');
    });

    // Rename file
    document.getElementById('fctx-rename')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!selectedFile) return;
        menu.classList.remove('show');
        
        const newName = prompt("Rename to:", selectedFile.name);
        if (newName && newName !== selectedFile.name) {
            console.log("RENAME_FILE:" + selectedFile.path + "|" + newName);
        }
    });

    // Copy path
    document.getElementById('fctx-copy')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectedFile) {
            navigator.clipboard?.writeText(selectedFile.path);
        }
        menu.classList.remove('show');
    });

    // Properties
    document.getElementById('fctx-properties')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectedFile) {
            console.log("FILE_PROPERTIES:" + selectedFile.path);
        }
        menu.classList.remove('show');
    });

    // Delete
    document.getElementById('fctx-delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectedFile && confirm(`Delete "${selectedFile.name}"?`)) {
            console.log("DELETE_FILE:" + selectedFile.path);
        }
        menu.classList.remove('show');
    });
})();
