/**
 * Player Class
 * Handles player rendering, movement, input, and sprite animation
 */

class Player {
    constructor(collisionSystem, startX = 5, startY = 12) {
        this.collisionSystem = collisionSystem;
        
        // Position in tiles
        this.tileX = startX;
        this.tileY = startY;
        
        // Visual properties
        this.size = 48; // 1 tile = 48x48 pixels (collision size)
        
        // Spritesheet properties
        this.spritesheet = new Image();
        this.spritesheetLoaded = false;
        this.frameWidth = 48;  // Will be calculated on load
        this.frameHeight = 48; // Will be calculated on load
        this.framesPerDirection = 6;
        
        // Render size - make character visually larger
        // Character extends upward from the collision tile (feet)
        this.renderScale = 1; // Scale factor (1.5 = 50% larger)
        
        // Direction offsets in the spritesheet (frame index where each direction starts)
        // Right: 0-5, Up: 6-11, Left: 12-17, Down: 18-23
        this.directionOffsets = {
            'right': 0,
            'up': 6,
            'left': 12,
            'down': 18
        };
        
        // Animation state
        this.currentDirection = 'down'; // Default facing direction
        this.currentFrame = 0;
        this.animationSpeed = 100; // milliseconds per frame
        this.lastAnimationTime = 0;
        this.isMoving = false;
        
        // Movement cooldown to prevent too fast movement
        this.moveCooldown = 0;
        this.moveCooldownTime = 150; // milliseconds
        this.lastMoveTime = 0;
        
        // Input state
        this.keys = {};
        
        // Load spritesheet
        this.loadSpritesheet();
        
        // Setup input listeners
        this.setupInput();
        
        console.log(`Player created at tile (${this.tileX}, ${this.tileY})`);
    }

    /**
     * Load the character spritesheet
     */
    loadSpritesheet() {
        this.spritesheet.onload = () => {
            this.spritesheetLoaded = true;
            
            // Calculate actual frame size based on spritesheet dimensions
            // Spritesheet is 24 frames in a single row
            const totalFrames = 24;
            this.frameWidth = this.spritesheet.width / totalFrames;
            this.frameHeight = this.spritesheet.height;
            
            console.log('Spritesheet loaded: GirlWalk.png');
            console.log(`Spritesheet size: ${this.spritesheet.width} x ${this.spritesheet.height}`);
            console.log(`Frame size: ${this.frameWidth} x ${this.frameHeight}`);
        };
        
        this.spritesheet.onerror = () => {
            console.error('Failed to load spritesheet: Character/GirlWalk.png');
            this.spritesheetLoaded = false;
        };
        
        this.spritesheet.src = 'Character/GirlWalk.png';
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
        const currentTime = Date.now();
        
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

        // Update direction even if not moving (for facing)
        if (direction) {
            this.currentDirection = direction;
            this.isMoving = true;
            
            // Check if enough time has passed since last move
            if (currentTime - this.lastMoveTime >= this.moveCooldownTime) {
                moved = this.tryMove(newX, newY, direction);
                if (moved) {
                    this.lastMoveTime = currentTime;
                }
            }
        } else {
            this.isMoving = false;
            // Reset to first frame when idle
            this.currentFrame = 0;
        }

        // Update animation frame if moving
        if (this.isMoving) {
            this.updateAnimation(currentTime);
        }

        return moved;
    }

    /**
     * Update the animation frame
     */
    updateAnimation(currentTime) {
        if (currentTime - this.lastAnimationTime >= this.animationSpeed) {
            this.currentFrame = (this.currentFrame + 1) % this.framesPerDirection;
            this.lastAnimationTime = currentTime;
        }
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
        // Convert tile position to pixel position (collision/feet position)
        const tilePixelX = this.tileX * this.size;
        const tilePixelY = this.tileY * this.size;

        if (this.spritesheetLoaded) {
            // Calculate source X position in spritesheet
            const frameIndex = this.directionOffsets[this.currentDirection] + this.currentFrame;
            const sourceX = frameIndex * this.frameWidth;
            const sourceY = 0;

            // Calculate scaled render size
            const renderWidth = this.frameWidth * this.renderScale;
            const renderHeight = this.frameHeight * this.renderScale;
            
            // Position sprite so bottom (feet) aligns with the collision tile
            // Center horizontally on the tile
            const drawX = tilePixelX + (this.size - renderWidth) / 2;
            // Align feet with bottom of collision tile (sprite extends upward)
            const drawY = tilePixelY + this.size - renderHeight;

            // Draw the scaled sprite
            ctx.drawImage(
                this.spritesheet,
                sourceX, sourceY,                   // Source position
                this.frameWidth, this.frameHeight,  // Source size
                drawX, drawY,                       // Destination position
                renderWidth, renderHeight           // Destination size (scaled)
            );
        } else {
            // Fallback: Draw a simple colored rectangle at tile position
            ctx.save();
            ctx.fillStyle = '#3498db';
            ctx.fillRect(tilePixelX, tilePixelY, this.size, this.size);
            ctx.strokeStyle = '#2980b9';
            ctx.lineWidth = 3;
            ctx.strokeRect(tilePixelX, tilePixelY, this.size, this.size);
            ctx.restore();
        }
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
