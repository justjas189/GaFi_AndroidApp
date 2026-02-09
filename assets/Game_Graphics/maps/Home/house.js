/**
 * Main Game Logic for 2D Tile-Based Game
 * RPG Maker MZ Collision System
 */

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
            
            // Initialize collision system
            const collisionLoaded = await this.collisionSystem.initialize();
            if (!collisionLoaded) {
                throw new Error('Failed to load collision data');
            }

            this.updateStatus('Loading map image...');
            
            // Load map background image
            await this.loadMapImage();

            this.updateStatus('Creating player...');
            
            // Create player at center of map (suggest tile 5, 12)
            this.player = new Player(this.collisionSystem, 5, 12);

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
                console.warn('Map002.png not found, will render without background');
                this.mapImageLoaded = false;
                resolve(); // Continue without background
            };
            
            this.mapImage.src = 'Map002.png';
            
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
            const moved = this.player.update(deltaTime);
            
            // Update status with player position
            if (moved) {
                const pos = this.player.getTilePosition();
                const tileInfo = this.player.getCurrentTileInfo();
                this.updateStatus(
                    `Position: (${pos.x}, ${pos.y}) | Tile ID: ${tileInfo.tileId} | ` +
                    `Flag: 0b${tileInfo.flagBinary} | Passable: ${tileInfo.passable}`
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

        // Draw collision visualization (optional debug mode)
        this.drawCollisionOverlay();

        // Draw player
        if (this.player) {
            this.player.render(this.ctx);
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
     * Draw collision overlay for debugging (optional)
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
            const pos = this.player.getTilePosition();
            
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(10, 10, 180, 60);
            
            this.ctx.fillStyle = 'white';
            this.ctx.font = '14px monospace';
            this.ctx.fillText(`Position: (${pos.x}, ${pos.y})`, 20, 30);
            
            const pixel = this.player.getPixelPosition();
            this.ctx.fillText(`Pixels: (${pixel.x}, ${pixel.y})`, 20, 50);
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
    console.log('Starting 2D Tile-Based Game with RPG Maker MZ Collision System');
    const game = new Game();
    game.init();
});
