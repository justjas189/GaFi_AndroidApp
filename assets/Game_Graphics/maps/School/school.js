class Game {
    constructor() {
        // Canvas setup
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Game dimensions
        this.tileSize = 48;
        this.mapWidth = 11;
        this.mapHeight = 24;
        
        // Game systems
        this.collisionSystem = new CollisionSystem();
        this.player = null;
        
        // Background map image
        this.mapImage = new Image();
        this.mapImageLoaded = false;
        
        // Game state
        this.running = false;
        this.lastTime = 0;
        
        // Status display
        this.statusElement = document.getElementById('status');
    }

    /**
     * Initialize the game
     */
    async init() {
        try {
            this.updateStatus('Loading collision data...');
            
            // Load collision data
            await this.collisionSystem.loadData();

            this.updateStatus('Loading map image...');
            
            // Load map background image
            await this.loadMapImage();

            this.updateStatus('Creating player...');
            
            // Create player at starting position (tile 0, 16)
            this.player = new Player(0, 16, this.collisionSystem);

            this.updateStatus('Game ready! Use Arrow Keys or WASD to move');
            
            console.log('Game initialized successfully');
            
            // Start game loop
            this.running = true;
            this.lastTime = performance.now();
            this.gameLoop(this.lastTime);
            
        } catch (error) {
            console.error('Game initialization failed:', error);
            this.updateStatus(`Error: ${error.message}`);
        }
    }

    /**
     * Load the map background image
     */
    loadMapImage() {
        return new Promise((resolve, reject) => {
            this.mapImage.onload = () => {
                this.mapImageLoaded = true;
                console.log('Map image loaded successfully');
                resolve();
            };
            
            this.mapImage.onerror = () => {
                console.warn('Map004.png not found, will render without background');
                this.mapImageLoaded = false;
                resolve(); // Continue without background
            };
            
            this.mapImage.src = 'Map004.png';
            
            // Timeout after 5 seconds
            setTimeout(() => {
                if (!this.mapImageLoaded) {
                    console.warn('Map image load timeout');
                    resolve();
                }
            }, 5000);
        });
    }

    /**
     * Main game loop
     */
    gameLoop(currentTime) {
        if (!this.running) return;

        // Calculate delta time
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Update game state
        this.update(deltaTime);

        // Render frame
        this.render();

        // Continue loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    /**
     * Update game state
     */
    update(deltaTime) {
        if (this.player) {
            const oldX = this.player.x;
            const oldY = this.player.y;
            
            this.player.update(Date.now());
            
            // Update status with player position if moved
            if (this.player.x !== oldX || this.player.y !== oldY) {
                const tileId = this.collisionSystem.getTileId(this.player.x, this.player.y);
                const flag = this.collisionSystem.getTileFlag(tileId);
                const flagBinary = flag !== null ? flag.toString(2).padStart(16, '0') : 'null';
                const passable = this.collisionSystem.isPassable(this.player.x, this.player.y);
                
                this.updateStatus(
                    `Position: (${this.player.x}, ${this.player.y}) | Tile ID: ${tileId} | ` +
                    `Flag: 0b${flagBinary} | Passable: ${passable}`
                );
            }
        }
    }

    /**
     * Render the game
     */
    render() {
        // Clear canvas
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw map background if loaded
        if (this.mapImageLoaded) {
            this.ctx.drawImage(this.mapImage, 0, 0);
        } else {
            // Draw grid as fallback
            this.drawGrid();
        }

        // Draw collision visualization
        this.drawCollisionOverlay();

        // Draw player
        if (this.player) {
            this.player.render(this.ctx, this.tileSize);
        }

        // Draw UI overlay
        this.drawUI();
    }

    /**
     * Draw a grid overlay (fallback if map image not loaded)
     */
    drawGrid() {
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;

        // Vertical lines
        for (let x = 0; x <= this.mapWidth; x++) {
            const px = x * this.tileSize;
            this.ctx.beginPath();
            this.ctx.moveTo(px, 0);
            this.ctx.lineTo(px, this.canvas.height);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= this.mapHeight; y++) {
            const py = y * this.tileSize;
            this.ctx.beginPath();
            this.ctx.moveTo(0, py);
            this.ctx.lineTo(this.canvas.width, py);
            this.ctx.stroke();
        }
    }

    /**
     * Draw collision overlay for debugging
     */
    drawCollisionOverlay() {
        this.ctx.globalAlpha = 0.3;
        
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const passable = this.collisionSystem.isPassable(x, y);
                const px = x * this.tileSize;
                const py = y * this.tileSize;
                
                if (passable) {
                    this.ctx.fillStyle = '#00ff00'; // Green for passable
                } else {
                    this.ctx.fillStyle = '#ff0000'; // Red for blocked
                }
                
                this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
            }
        }
        
        this.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw UI elements
     */
    drawUI() {
        // Draw position indicator in top-left corner
        if (this.player) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(10, 10, 200, 60);
            
            this.ctx.fillStyle = 'white';
            this.ctx.font = '14px monospace';
            this.ctx.fillText(`Position: (${this.player.x}, ${this.player.y})`, 20, 30);
            
            const pixelX = this.player.x * this.tileSize;
            const pixelY = this.player.y * this.tileSize;
            this.ctx.fillText(`Pixels: (${pixelX}, ${pixelY})`, 20, 50);
        }
    }

    /**
     * Update status display
     */
    updateStatus(message) {
        if (this.statusElement) {
            this.statusElement.innerHTML = `<p>${message}</p>`;
        }
    }

    /**
     * Stop the game
     */
    stop() {
        this.running = false;
        console.log('Game stopped');
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    console.log('Starting School Map with RPG Maker MZ Collision System');
    const game = new Game();
    game.init();
});
