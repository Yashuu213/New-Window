// Global functions to be called by Python injection
window.renderApps = function(apps) {
    const loading = document.getElementById('dock-loading');
    if (loading) loading.remove();
    
    const rightDock = document.getElementById('dynamic-dock');
    const bottomDock = document.getElementById('bottom-dock');
    const divider = document.getElementById('dock-divider');
    
    apps.forEach((app, index) => {
        // --- ADD TO RIGHT DOCK ---
        const rightItem = document.createElement('div');
        rightItem.className = 'dock-item';
        rightItem.title = app.name;
        rightItem.style.animationDelay = `${index * 0.05}s`;
        
        const img1 = document.createElement('img');
        img1.src = app.icon;
        img1.style.width = '32px';
        img1.style.height = '32px';
        img1.style.objectFit = 'contain';
        img1.style.pointerEvents = 'none';
        rightItem.appendChild(img1);
        
        rightItem.addEventListener('click', () => {
            console.log("LAUNCH:" + app.path);
            rightItem.style.transform = 'scale(0.9) translateY(0)';
            setTimeout(() => rightItem.style.transform = '', 150);
        });
        rightDock.insertBefore(rightItem, divider);

        // --- ADD TO BOTTOM DOCK (Max 6 Apps) ---
        if (index < 6) {
            const bottomApps = document.getElementById('bottom-apps');
            const bottomItem = document.createElement('div');
            bottomItem.className = 'bottom-dock-item';
            bottomItem.title = app.name;
            bottomItem.style.animationDelay = `${index * 0.05}s`;

            const img2 = document.createElement('img');
            img2.src = app.icon;
            img2.style.width = '28px'; // Slightly smaller for taskbar look
            img2.style.height = '28px';
            img2.style.objectFit = 'contain';
            img2.style.pointerEvents = 'none';
            bottomItem.appendChild(img2);

            // Fake active state indicator (pill) for the first 2 apps
            if (index < 2) {
                const pill = document.createElement('div');
                pill.style.position = 'absolute';
                pill.style.bottom = '2px';
                pill.style.width = '12px';
                pill.style.height = '3px';
                pill.style.background = 'rgba(255, 255, 255, 0.8)';
                pill.style.borderRadius = '2px';
                bottomItem.appendChild(pill);
            }

            bottomItem.addEventListener('click', () => {
                console.log("LAUNCH:" + app.path);
                bottomItem.style.transform = 'scale(0.9) translateY(0)';
                setTimeout(() => bottomItem.style.transform = '', 150);
            });
            bottomApps.appendChild(bottomItem);
        }
    });
    
    divider.style.display = 'block';
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
