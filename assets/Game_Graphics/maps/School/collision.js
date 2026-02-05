class CollisionSystem {
    constructor() {
        this.mapData = null;
        this.tilesetData = null;
        this.tileSize = 48;
        this.mapWidth = 0;
        this.mapHeight = 0;
    }

    async loadData() {
        try {
            // Load Map004.json
            const mapResponse = await fetch('Map004.json');
            this.mapData = await mapResponse.json();
            this.mapWidth = this.mapData.width;
            this.mapHeight = this.mapData.height;
            
            // Load Tilesets.json
            const tilesetResponse = await fetch('Tilesets.json');
            const tilesets = await tilesetResponse.json();
            
            // Find tileset with id 4 (School)
            this.tilesetData = tilesets.find(t => t && t.id === 4);
            
            if (!this.tilesetData) {
                throw new Error('Tileset ID 4 not found');
            }
            
            console.log('Loaded Map004.json:', this.mapData);
            console.log('Loaded Tileset ID 4:', this.tilesetData);
            console.log('Map dimensions:', this.mapWidth, 'x', this.mapHeight);
            
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    getTileId(x, y) {
        if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
            return 0;
        }
        
        const baseIndex = y * this.mapWidth + x;
        const layerSize = this.mapWidth * this.mapHeight;
        
        // Check all 4 layers (from top to bottom: layer 3, 2, 1, 0)
        for (let layer = 3; layer >= 0; layer--) {
            const index = layer * layerSize + baseIndex;
            const tileId = this.mapData.data[index];
            if (tileId && tileId > 0) {
                return tileId;
            }
        }
        
        return 0;
    }

    getTileFlag(tileId) {
        if (!this.tilesetData || !this.tilesetData.flags) {
            return null;
        }
        return this.tilesetData.flags[tileId] || null;
    }

    isPassable(x, y) {
        const tileId = this.getTileId(x, y);
        
        // Empty tiles are passable
        if (tileId === 0) return true;
        
        const flag = this.getTileFlag(tileId);
        
        // null flags mean passable tiles
        if (flag === null) {
            return true;
        }
        
        // Check lower nibble (0x000F) - if it's 0, tile is passable
        const isPassable = (flag & 0x000F) === 0;
        
        // Debug logging
        console.log(`Tile at (${x}, ${y}): ID=${tileId}, Flag=${flag}, Binary=${flag.toString(2).padStart(16, '0')}, Passable=${isPassable}`);
        
        return isPassable;
    }

    canMoveTo(fromX, fromY, toX, toY) {
        // Check if destination is passable
        if (!this.isPassable(toX, toY)) {
            console.log(`Movement blocked: destination (${toX}, ${toY}) is not passable`);
            return false;
        }
        
        // Check source tile for directional blocking
        const fromTileId = this.getTileId(fromX, fromY);
        if (fromTileId !== 0) {
            const fromFlag = this.getTileFlag(fromTileId);
            
            // null flags don't block movement
            if (fromFlag !== null) {
                const dx = toX - fromX;
                const dy = toY - fromY;
                
                // Check directional bits (bits 0-3)
                // Bit 0 (0x01): down blocked
                // Bit 1 (0x02): left blocked  
                // Bit 2 (0x04): right blocked
                // Bit 3 (0x08): up blocked
                
                if (dy > 0 && (fromFlag & 0x01)) { // Moving down
                    console.log(`Movement blocked: source tile blocks downward movement`);
                    return false;
                }
                if (dx < 0 && (fromFlag & 0x02)) { // Moving left
                    console.log(`Movement blocked: source tile blocks leftward movement`);
                    return false;
                }
                if (dx > 0 && (fromFlag & 0x04)) { // Moving right
                    console.log(`Movement blocked: source tile blocks rightward movement`);
                    return false;
                }
                if (dy < 0 && (fromFlag & 0x08)) { // Moving up
                    console.log(`Movement blocked: source tile blocks upward movement`);
                    return false;
                }
            }
        }
        
        return true;
    }
}
