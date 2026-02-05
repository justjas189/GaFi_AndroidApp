class Player {
    constructor(x, y, collisionSystem) {
        this.x = x;
        this.y = y;
        this.collisionSystem = collisionSystem;
        this.keys = {};
        this.moveDelay = 150;
        this.lastMoveTime = 0;
        
        // Listen for keyboard input
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }
    
    update(currentTime) {
        // Check if enough time has passed since last move
        if (currentTime - this.lastMoveTime < this.moveDelay) {
            return;
        }
        
        let newX = this.x;
        let newY = this.y;
        
        // Check movement keys
        if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) {
            newY = this.y - 1;
        } else if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) {
            newY = this.y + 1;
        } else if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
            newX = this.x - 1;
        } else if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
            newX = this.x + 1;
        }
        
        // Try to move if position changed
        if (newX !== this.x || newY !== this.y) {
            this.tryMove(newX, newY, currentTime);
        }
    }
    
    tryMove(newX, newY, currentTime) {
        // Check bounds
        if (newX < 0 || newX >= this.collisionSystem.mapWidth || 
            newY < 0 || newY >= this.collisionSystem.mapHeight) {
            console.log('Movement blocked: out of bounds');
            return;
        }
        
        // Check collision
        if (this.collisionSystem.canMoveTo(this.x, this.y, newX, newY)) {
            this.x = newX;
            this.y = newY;
            this.lastMoveTime = currentTime;
            console.log(`Player moved to (${this.x}, ${this.y})`);
        }
    }
    
    render(ctx, tileSize) {
        // Draw player as a blue circle
        ctx.fillStyle = '#3498db';
        ctx.beginPath();
        ctx.arc(
            this.x * tileSize + tileSize / 2,
            this.y * tileSize + tileSize / 2,
            tileSize / 3,
            0,
            Math.PI * 2
        );
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = '#2980b9';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}
