// Global functions to be called by Python injection
window.renderApps = function(apps) {
    const loading = document.getElementById('dock-loading');
    if (loading) loading.remove();
    
    const dock = document.getElementById('dynamic-dock');
    const divider = document.getElementById('dock-divider');
    
    apps.forEach((app, index) => {
        const item = document.createElement('div');
        item.className = 'dock-item';
        item.title = app.name;
        item.style.animationDelay = `${index * 0.05}s`;
        
        const img = document.createElement('img');
        img.src = app.icon;
        img.style.width = '32px';
        img.style.height = '32px';
        img.style.objectFit = 'contain';
        img.style.pointerEvents = 'none';
        item.appendChild(img);
        
        item.addEventListener('click', () => {
            console.log("LAUNCH:" + app.path); // Python will intercept this!
            item.style.transform = 'scale(0.9) translateY(0)';
            setTimeout(() => {
                item.style.transform = '';
            }, 150);
        });
        
        dock.insertBefore(item, divider);
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
