/**
 * Collision Detection System for RPG Maker MZ
 * 
 * RPG Maker MZ uses a bitflag system for tile passability:
 * - Bit 4 (0x0010 = 16): Passable bit (must be set for tile to be walkable)
 * - Bits 0-3 (0x000F = 15): Directional blocking
 *   - Bit 0 (0x0001 = 1): Block movement DOWN
 *   - Bit 1 (0x0002 = 2): Block movement LEFT
 *   - Bit 2 (0x0004 = 4): Block movement RIGHT
 *   - Bit 3 (0x0008 = 8): Block movement UP
 */

class CollisionSystem {
    constructor() {
        this.mapData = null;
        this.tilesetFlags = null;
        this.mapWidth = 0;
        this.mapHeight = 0;
        this.tileSize = 48;
    }

    /**
     * Initialize the collision system with map and tileset data
     */
    async initialize() {
        try {
            // Load Map002.json
            const mapResponse = await fetch('Map002.json');
            const mapJson = await mapResponse.json();
            this.mapData = mapJson.data;
            this.mapWidth = mapJson.width;
            this.mapHeight = mapJson.height;

            // Load Tilesets.json
            const tilesetsResponse = await fetch('Tilesets.json');
            const tilesetsJson = await tilesetsResponse.json();
            
            // Get tileset with ID 1 (House Indoors)
            const houseTileset = tilesetsJson.find(t => t && t.id === 1);
            if (houseTileset) {
                this.tilesetFlags = houseTileset.flags;
            } else {
                console.error('Tileset ID 1 not found');
                this.tilesetFlags = [];
            }

            console.log(`Collision system initialized: ${this.mapWidth}x${this.mapHeight} tiles`);
            console.log(`Loaded ${this.tilesetFlags.length} tile flags`);
            
            // Test specific tile IDs
            console.log('Testing tile flags:');
            const flag1536 = this.tilesetFlags[1536] || 0;
            const flag1551 = this.tilesetFlags[1551] || 0;
            console.log(`  Tile ID 1536 flag: ${flag1536} (lower nibble: ${flag1536 & 0x000F}) → passable: ${(flag1536 & 0x000F) === 0}`);
            console.log(`  Tile ID 1551 flag: ${flag1551} (lower nibble: ${flag1551 & 0x000F}) → passable: ${(flag1551 & 0x000F) === 0}`);
            
            return true;
        } catch (error) {
            console.error('Failed to initialize collision system:', error);
            return false;
        }
    }

    /**
     * Convert tile coordinates to array index
     */
    coordsToIndex(x, y) {
        return y * this.mapWidth + x;
    }

    /**
     * Convert array index to tile coordinates
     */
    indexToCoords(index) {
        return {
            x: index % this.mapWidth,
            y: Math.floor(index / this.mapWidth)
        };
    }

    /**
     * Convert tile coordinates to pixel coordinates
     */
    tilesToPixels(x, y) {
        return {
            x: x * this.tileSize,
            y: y * this.tileSize
        };
    }

    /**
     * Convert pixel coordinates to tile coordinates
     */
    pixelsToTiles(x, y) {
        return {
            x: Math.floor(x / this.tileSize),
            y: Math.floor(y / this.tileSize)
        };
    }

    /**
     * Get the tile ID at the specified tile coordinates
     * RPG Maker MZ stores data in layers stacked in the data array:
     * Layer 0: indices 0 to (width*height - 1)
     * Layer 1: indices (width*height) to (2*width*height - 1)
     * Layer 2: indices (2*width*height) to (3*width*height - 1)
     * Layer 3: indices (3*width*height) to (4*width*height - 1)
     * 
     * We check from top layer down and return the first non-zero tile
     */
    getTileId(x, y) {
        // Check bounds
        if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
            return 0;
        }

        const baseIndex = this.coordsToIndex(x, y);
        const layerSize = this.mapWidth * this.mapHeight;
        const numLayers = Math.floor(this.mapData.length / layerSize);

        // Check layers from top to bottom (reverse order for priority)
        // Higher layers have collision priority
        for (let layer = numLayers - 1; layer >= 0; layer--) {
            const index = baseIndex + (layer * layerSize);
            const tileId = this.mapData[index];
            
            if (tileId && tileId > 0) {
                return tileId;
            }
        }

        return 0; // No tile found
    }

    /**
     * Get the collision flag for a specific tile
     */
    getTileFlag(tileId) {
        if (tileId === 0 || !this.tilesetFlags) {
            return 16; // Default passable
        }
        return this.tilesetFlags[tileId] || 16;
    }

    /**
     * Check if a tile is passable (RPG Maker MZ logic)
     * 
     * RPG Maker MZ flag system:
     * - Lower nibble (bits 0-3, mask 0x000F) = directional blocking
     *   - If all 4 bits are 0, tile is passable in all directions
     *   - If any bits are set, those directions are blocked
     * - Higher bits are for rendering/layer options
     */
    isPassable(x, y) {
        // Out of bounds = not passable
        if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
            return false;
        }

        const tileId = this.getTileId(x, y);
        
        // Empty tile = passable
        if (tileId === 0) {
            return true;
        }
        
        const flag = this.getTileFlag(tileId);

        // A tile is passable if the lower nibble (directional bits) is 0
        const isPassable = (flag & 0x000F) === 0;

        return isPassable;
    }

    /**
     * Check if movement in a specific direction is blocked
     * direction: 'down', 'left', 'right', 'up'
     */
    isDirectionBlocked(x, y, direction) {
        const tileId = this.getTileId(x, y);
        const flag = this.getTileFlag(tileId);

        const directionBits = {
            'down': 0x0001,  // Bit 0
            'left': 0x0002,  // Bit 1
            'right': 0x0004, // Bit 2
            'up': 0x0008     // Bit 3
        };

        return (flag & directionBits[direction]) !== 0;
    }

    /**
     * Check if the player can move from one tile to another
     */
    canMoveTo(fromX, fromY, toX, toY) {
        // Check if destination is passable
        if (!this.isPassable(toX, toY)) {
            console.log(`  → Destination (${toX}, ${toY}) not passable`);
            return false;
        }

        // Determine movement direction
        let direction = null;
        if (toY > fromY) direction = 'down';
        else if (toY < fromY) direction = 'up';
        else if (toX < fromX) direction = 'left';
        else if (toX > fromX) direction = 'right';

        // Check if movement from source tile is blocked in that direction
        if (direction && this.isDirectionBlocked(fromX, fromY, direction)) {
            const fromTileId = this.getTileId(fromX, fromY);
            const fromFlag = this.getTileFlag(fromTileId);
            console.log(`  → Source tile (${fromX}, ${fromY}) blocks ${direction} movement (tileID: ${fromTileId}, flag: ${fromFlag}, blocking bits: ${fromFlag & 0x000F})`);
            return false;
        }

        return true;
    }

    /**
     * Get collision info for debugging
     */
    getTileInfo(x, y) {
        const tileId = this.getTileId(x, y);
        const flag = this.getTileFlag(tileId);
        
        return {
            x,
            y,
            tileId,
            flag,
            flagBinary: flag.toString(2).padStart(8, '0'),
            passable: this.isPassable(x, y),
            blockedDown: (flag & 0x0001) !== 0,
            blockedLeft: (flag & 0x0002) !== 0,
            blockedRight: (flag & 0x0004) !== 0,
            blockedUp: (flag & 0x0008) !== 0,
            hasPassableBit: (flag & 0x0010) !== 0
        };
    }
}
