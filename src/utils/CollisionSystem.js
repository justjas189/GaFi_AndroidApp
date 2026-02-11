/**
 * Collision Detection System for RPG Maker MZ Maps
 * 
 * RPG Maker MZ uses a bitflag system for tile passability:
 * - Bit 4 (0x0010 = 16): Passable bit (must be set for tile to be walkable)
 * - Bits 0-3 (0x000F = 15): Directional blocking
 *   - Bit 0 (0x0001 = 1): Block movement DOWN
 *   - Bit 1 (0x0002 = 2): Block movement LEFT
 *   - Bit 2 (0x0004 = 4): Block movement RIGHT
 *   - Bit 3 (0x0008 = 8): Block movement UP
 */

// Import map data directly
import Map002Data from '../../assets/Game_Graphics/maps/Map002.json';
import Map003Data from '../../assets/Game_Graphics/maps/Map003.json';
import Map004Data from '../../assets/Game_Graphics/maps/Map004.json';
import TilesetsData from '../../assets/Game_Graphics/maps/Tilesets.json';
import MallTilesetsData from '../../assets/Game_Graphics/maps/Mall_Tilesets.json';
import SchoolTilesetsData from '../../assets/Game_Graphics/maps/School_Tilesets.json';

class CollisionSystem {
  constructor() {
    this.mapData = null;
    this.tilesetFlags = null;
    this.mapWidth = 0;
    this.mapHeight = 0;
    this.tileSize = 48; // RPG Maker MZ default tile size
    this.initialized = false;
    this.currentMapId = null;
  }

  /**
   * Initialize the collision system with map and tileset data
   */
  initialize(mapId = 'dorm') {
    try {
      this.currentMapId = mapId;
      
      // Dorm/House map (Map002)
      if (mapId === 'dorm') {
        this.mapData = Map002Data.data;
        this.mapWidth = Map002Data.width; // 11 tiles
        this.mapHeight = Map002Data.height; // 24 tiles

        // Get tileset with ID 1 (House Indoors)
        const houseTileset = TilesetsData.find(t => t && t.id === 1);
        if (houseTileset) {
          this.tilesetFlags = houseTileset.flags;
        } else {
          console.error('Tileset ID 1 not found');
          this.tilesetFlags = [];
        }

        console.log(`✅ Collision system initialized for DORM: ${this.mapWidth}x${this.mapHeight} tiles`);
        console.log(`   Loaded ${this.tilesetFlags.length} tile flags`);
        this.initialized = true;
        return true;
      }
      
      // Mall map (Map003)
      if (mapId === 'mall') {
        this.mapData = Map003Data.data;
        this.mapWidth = Map003Data.width; // 11 tiles
        this.mapHeight = Map003Data.height; // 24 tiles

        // Get tileset with ID 2 (Mall/Outside tileset)
        const mallTileset = MallTilesetsData.find(t => t && t.id === 2);
        if (mallTileset) {
          this.tilesetFlags = mallTileset.flags;
        } else {
          console.error('Tileset ID 2 not found');
          this.tilesetFlags = [];
        }

        console.log(`✅ Collision system initialized for MALL: ${this.mapWidth}x${this.mapHeight} tiles`);
        console.log(`   Loaded ${this.tilesetFlags.length} tile flags`);
        this.initialized = true;
        return true;
      }
      
      // School map (Map004)
      if (mapId === 'school') {
        this.mapData = Map004Data.data;
        this.mapWidth = Map004Data.width; // 11 tiles
        this.mapHeight = Map004Data.height; // 24 tiles

        // Get tileset with ID 4 (School)
        const schoolTileset = SchoolTilesetsData.find(t => t && t.id === 4);
        if (schoolTileset) {
          this.tilesetFlags = schoolTileset.flags;
        } else {
          console.error('Tileset ID 4 not found');
          this.tilesetFlags = [];
        }

        console.log(`✅ Collision system initialized for SCHOOL: ${this.mapWidth}x${this.mapHeight} tiles`);
        console.log(`   Loaded ${this.tilesetFlags.length} tile flags`);
        this.initialized = true;
        return true;
      }
      
      // For other maps, collision isn't implemented yet
      console.log(`⚠️ Collision not available for map: ${mapId}`);
      this.initialized = false;
      return false;
    } catch (error) {
      console.error('Failed to initialize collision system:', error);
      this.initialized = false;
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
   * Convert pixel coordinates to tile coordinates
   * @param {number} pixelX - X position in pixels
   * @param {number} pixelY - Y position in pixels
   * @param {number} screenWidth - Current screen/container width
   * @param {number} screenHeight - Current screen/container height
   */
  pixelsToTiles(pixelX, pixelY, screenWidth, screenHeight) {
    // Calculate the scale factor based on the content size vs map size
    const mapPixelWidth = this.mapWidth * this.tileSize; // 11 * 48 = 528
    const mapPixelHeight = this.mapHeight * this.tileSize; // 24 * 48 = 1152

    // Calculate scale to fit map in screen (similar to resizeMode="contain")
    const scaleX = screenWidth / mapPixelWidth;
    const scaleY = screenHeight / mapPixelHeight;
    const scale = Math.min(scaleX, scaleY);

    // Calculate actual displayed map size
    const displayedMapWidth = mapPixelWidth * scale;
    const displayedMapHeight = mapPixelHeight * scale;

    // Calculate offset (centering)
    const offsetX = (screenWidth - displayedMapWidth) / 2;
    const offsetY = (screenHeight - displayedMapHeight) / 2;

    // Convert screen position to map position
    const mapX = (pixelX - offsetX) / scale;
    const mapY = (pixelY - offsetY) / scale;

    // Convert to tile coordinates
    const tileX = Math.floor(mapX / this.tileSize);
    const tileY = Math.floor(mapY / this.tileSize);

    return { x: tileX, y: tileY };
  }

  /**
   * Convert tile coordinates to pixel coordinates
   * @param {number} tileX - X position in tiles
   * @param {number} tileY - Y position in tiles
   * @param {number} screenWidth - Current screen/container width
   * @param {number} screenHeight - Current screen/container height
   */
  tilesToPixels(tileX, tileY, screenWidth, screenHeight) {
    const mapPixelWidth = this.mapWidth * this.tileSize;
    const mapPixelHeight = this.mapHeight * this.tileSize;

    const scaleX = screenWidth / mapPixelWidth;
    const scaleY = screenHeight / mapPixelHeight;
    const scale = Math.min(scaleX, scaleY);

    const displayedMapWidth = mapPixelWidth * scale;
    const displayedMapHeight = mapPixelHeight * scale;

    const offsetX = (screenWidth - displayedMapWidth) / 2;
    const offsetY = (screenHeight - displayedMapHeight) / 2;

    // Convert tile position to pixel position (center of tile)
    const pixelX = offsetX + (tileX * this.tileSize + this.tileSize / 2) * scale;
    const pixelY = offsetY + (tileY * this.tileSize + this.tileSize / 2) * scale;

    return { x: pixelX, y: pixelY };
  }

  /**
   * Get the tile ID at the specified tile coordinates
   * RPG Maker MZ stores data in layers stacked in the data array
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
   * A tile is passable if the lower nibble (directional bits) is 0
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
    const passable = (flag & 0x000F) === 0;

    return passable;
  }

  /**
   * Check if pixel position is passable
   * @param {number} pixelX - X position in pixels
   * @param {number} pixelY - Y position in pixels
   * @param {number} screenWidth - Current screen/container width
   * @param {number} screenHeight - Current screen/container height
   */
  isPixelPositionPassable(pixelX, pixelY, screenWidth, screenHeight) {
    if (!this.initialized) {
      return true; // Allow movement if collision isn't initialized
    }

    const tile = this.pixelsToTiles(pixelX, pixelY, screenWidth, screenHeight);
    
    // Check if outside map bounds
    if (tile.x < 0 || tile.x >= this.mapWidth || tile.y < 0 || tile.y >= this.mapHeight) {
      return false; // Don't allow movement outside map
    }

    return this.isPassable(tile.x, tile.y);
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
   * Check if the player can move from one position to another (in pixels)
   * @param {number} fromX - Starting X position in pixels
   * @param {number} fromY - Starting Y position in pixels
   * @param {number} toX - Target X position in pixels
   * @param {number} toY - Target Y position in pixels
   * @param {number} screenWidth - Current screen/container width
   * @param {number} screenHeight - Current screen/container height
   */
  canMoveTo(fromX, fromY, toX, toY, screenWidth, screenHeight) {
    if (!this.initialized) {
      return true; // Allow movement if collision isn't initialized
    }

    const fromTile = this.pixelsToTiles(fromX, fromY, screenWidth, screenHeight);
    const toTile = this.pixelsToTiles(toX, toY, screenWidth, screenHeight);

    // Check if destination is passable
    if (!this.isPassable(toTile.x, toTile.y)) {
      console.log(`🚫 Destination tile (${toTile.x}, ${toTile.y}) not passable`);
      return false;
    }

    // Determine movement direction
    let direction = null;
    if (toTile.y > fromTile.y) direction = 'down';
    else if (toTile.y < fromTile.y) direction = 'up';
    else if (toTile.x < fromTile.x) direction = 'left';
    else if (toTile.x > fromTile.x) direction = 'right';

    // Check if movement from source tile is blocked in that direction
    if (direction && this.isDirectionBlocked(fromTile.x, fromTile.y, direction)) {
      console.log(`🚫 Movement ${direction} blocked from tile (${fromTile.x}, ${fromTile.y})`);
      return false;
    }

    return true;
  }

  /**
   * Find the nearest passable position to the target
   * @param {number} targetX - Target X position in pixels
   * @param {number} targetY - Target Y position in pixels
   * @param {number} screenWidth - Current screen/container width
   * @param {number} screenHeight - Current screen/container height
   * @returns {object} - {x, y} pixel coordinates of nearest passable position
   */
  findNearestPassablePosition(targetX, targetY, screenWidth, screenHeight) {
    if (!this.initialized) {
      return { x: targetX, y: targetY };
    }

    const targetTile = this.pixelsToTiles(targetX, targetY, screenWidth, screenHeight);
    
    // If target is already passable, return it
    if (this.isPassable(targetTile.x, targetTile.y)) {
      return { x: targetX, y: targetY };
    }

    // Search in expanding squares around the target
    for (let radius = 1; radius <= 5; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          // Only check the edge of the square
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          
          const checkX = targetTile.x + dx;
          const checkY = targetTile.y + dy;
          
          if (this.isPassable(checkX, checkY)) {
            return this.tilesToPixels(checkX, checkY, screenWidth, screenHeight);
          }
        }
      }
    }

    // No passable position found, return original
    return { x: targetX, y: targetY };
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
      flagBinary: flag.toString(2).padStart(16, '0'),
      passable: this.isPassable(x, y),
      blockedDown: (flag & 0x0001) !== 0,
      blockedLeft: (flag & 0x0002) !== 0,
      blockedRight: (flag & 0x0004) !== 0,
      blockedUp: (flag & 0x0008) !== 0,
    };
  }

  /**
   * Check if a tile position contains wall-type autotiles (A3/A4)
   * Used to distinguish actual walls from furniture/objects with collision.
   *
   * RPG Maker MZ tile ID ranges:
   *   A3 (wall tops/buildings): 4352 - 5887
   *   A4 (wall surfaces):       5888 - 8191
   *   B-E (decorations/furniture): 0 - 1535
   *   A5 (simple ground):       1536 - 1663
   *   A1 (animated):            2048 - 2815
   *   A2 (ground):              2816 - 4351
   */
  isWallTile(x, y) {
    if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) return false;
    if (!this.mapData) return false;

    const baseIndex = this.coordsToIndex(x, y);
    const layerSize = this.mapWidth * this.mapHeight;
    const numLayers = Math.floor(this.mapData.length / layerSize);

    for (let layer = 0; layer < numLayers; layer++) {
      const index = baseIndex + (layer * layerSize);
      const tileId = this.mapData[index];
      // A3 and A4 autotiles are wall tiles
      if (tileId >= 4352 && tileId <= 8191) {
        return true;
      }
    }
    return false;
  }

  /**
   * Debug: Print passability map to console
   */
  debugPrintPassabilityMap() {
    if (!this.initialized) {
      console.log('Collision system not initialized');
      return;
    }

    console.log('Passability Map:');
    console.log('(O = passable, X = blocked)');
    
    for (let y = 0; y < this.mapHeight; y++) {
      let row = '';
      for (let x = 0; x < this.mapWidth; x++) {
        row += this.isPassable(x, y) ? 'O' : 'X';
      }
      console.log(`Row ${y.toString().padStart(2, '0')}: ${row}`);
    }
  }
}

// Export singleton instance
export const collisionSystem = new CollisionSystem();
export default CollisionSystem;
