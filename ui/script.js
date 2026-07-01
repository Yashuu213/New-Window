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
        
        appDrawerGrid.appendChild(item);
    });

    // Populate bottom dock with top 6 apps as pins
    const bottomApps = document.getElementById('bottom-apps');
    if (bottomApps) {
        bottomApps.innerHTML = '';
        for(let i=0; i<Math.min(6, apps.length); i++) {
            const app = apps[i];
            const bottomItem = document.createElement('div');
            bottomItem.className = 'bottom-dock-item';
            bottomItem.title = app.name;
            
            if (app.icon === "fallback" || !app.icon) {
                bottomItem.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8" style="width:28px; height:28px;"><rect x="3" y="3" width="18" height="18" rx="4"></rect><path d="M3 9h18M9 21V9"></path></svg>`;
            } else {
                const img2 = document.createElement('img');
                img2.src = app.icon;
                img2.style.width = '28px';
                bottomItem.appendChild(img2);
            }
            
            bottomItem.addEventListener('click', () => {
                console.log("LAUNCH:" + app.path);
            });
            bottomApps.appendChild(bottomItem);
        }
    }

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
        const container = document.getElementById('open-windows-tabs');
        if (!container) return;
        
        container.innerHTML = '';
        windows.forEach((win, index) => {
            const tab = document.createElement('div');
            tab.className = 'window-tab';
            tab.textContent = (index + 1).toString();
            tab.title = win.title; // Show app name on hover
            
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

    // --- VOLUME & BRIGHTNESS SLIDERS ---
    const volSlider = document.querySelector('#pop-vol .horizontal-slider');
    const brightSlider = document.querySelector('#pop-bright .horizontal-slider');
    
    volSlider?.addEventListener('input', (e) => {
        const val = e.target.value;
        console.log(`SET_VOLUME:${val}`);
    });
    
    brightSlider?.addEventListener('input', (e) => {
        const val = e.target.value;
        console.log(`SET_BRIGHTNESS:${val}`);
    });
