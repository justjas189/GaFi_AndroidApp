/**
 * Player Class
 * Handles player rendering, movement, and input
 */

class Player {
    constructor(collisionSystem, startX = 5, startY = 12) {
        this.collisionSystem = collisionSystem;
        
        // Position in tiles
        this.tileX = startX;
        this.tileY = startY;
        
        // Visual properties
        this.size = 48; // 1 tile = 48x48 pixels
        this.color = '#3498db'; // Blue color for player
        this.borderColor = '#2980b9';
        this.borderWidth = 3;
        
        // Movement cooldown to prevent too fast movement
        this.moveCooldown = 0;
        this.moveCooldownTime = 150; // milliseconds
        this.lastMoveTime = 0;
        
        // Input state
        this.keys = {};
        
        // Setup input listeners
        this.setupInput();
        
        console.log(`Player created at tile (${this.tileX}, ${this.tileY})`);
    }

    /**
     * Setup keyboard input listeners
     */
    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            
            // Prevent arrow keys from scrolling the page
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    /**
     * Update player state (called every frame)
     */
    update(deltaTime) {
        // Check if enough time has passed since last move
        const currentTime = Date.now();
        if (currentTime - this.lastMoveTime < this.moveCooldownTime) {
            return;
        }

        // Check for movement input
        let moved = false;
        let newX = this.tileX;
        let newY = this.tileY;
        let direction = null;

        // Check arrow keys and WASD
        if (this.keys['arrowup'] || this.keys['w']) {
            newY = this.tileY - 1;
            direction = 'up';
        } else if (this.keys['arrowdown'] || this.keys['s']) {
            newY = this.tileY + 1;
            direction = 'down';
        } else if (this.keys['arrowleft'] || this.keys['a']) {
            newX = this.tileX - 1;
            direction = 'left';
        } else if (this.keys['arrowright'] || this.keys['d']) {
            newX = this.tileX + 1;
            direction = 'right';
        }

        // Attempt to move if a direction was pressed
        if (direction) {
            moved = this.tryMove(newX, newY, direction);
            if (moved) {
                this.lastMoveTime = currentTime;
            }
        }

        return moved;
    }

    /**
     * Try to move to a new position
     */
    tryMove(newX, newY, direction) {
        // Check collision
        if (this.collisionSystem.canMoveTo(this.tileX, this.tileY, newX, newY)) {
            this.tileX = newX;
            this.tileY = newY;
            console.log(`Player moved ${direction} to (${this.tileX}, ${this.tileY})`);
            return true;
        } else {
            console.log(`Movement ${direction} blocked at (${newX}, ${newY})`);
            return false;
        }
    }

    /**
     * Render the player on the canvas
     */
    render(ctx) {
        // Convert tile position to pixel position
        const pixelX = this.tileX * this.size;
        const pixelY = this.tileY * this.size;

        // Draw player as a rounded rectangle with border
        ctx.save();

        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(pixelX + 4, pixelY + 4, this.size, this.size);

        // Draw border
        ctx.fillStyle = this.borderColor;
        ctx.fillRect(pixelX, pixelY, this.size, this.size);

        // Draw main body
        ctx.fillStyle = this.color;
        ctx.fillRect(
            pixelX + this.borderWidth, 
            pixelY + this.borderWidth, 
            this.size - this.borderWidth * 2, 
            this.size - this.borderWidth * 2
        );

        // Draw simple face/direction indicator
        ctx.fillStyle = 'white';
        
        // Eyes
        const eyeSize = 4;
        const eyeY = pixelY + 18;
        ctx.fillRect(pixelX + 14, eyeY, eyeSize, eyeSize);
        ctx.fillRect(pixelX + 30, eyeY, eyeSize, eyeSize);

        // Mouth
        ctx.fillRect(pixelX + 16, pixelY + 30, 16, 3);

        ctx.restore();
    }

    /**
     * Get player's current position in pixels
     */
    getPixelPosition() {
        return {
            x: this.tileX * this.size,
            y: this.tileY * this.size
        };
    }

    /**
     * Get player's current tile position
     */
    getTilePosition() {
        return {
            x: this.tileX,
            y: this.tileY
        };
    }

    /**
     * Get current tile info for debugging
     */
    getCurrentTileInfo() {
        return this.collisionSystem.getTileInfo(this.tileX, this.tileY);
    }
}
