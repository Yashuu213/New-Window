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
