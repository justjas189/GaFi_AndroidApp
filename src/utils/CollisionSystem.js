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
import Map004Data from '../../assets/Game_Graphics/maps/School/Map004.json';
import Map006Data from '../../assets/Game_Graphics/maps/Mall/Map006.json';
import Map007Data from '../../assets/Game_Graphics/maps/Mall/Map007.json';
import Map008Data from '../../assets/Game_Graphics/maps/Mall/Map008.json';
import Map010Data from '../../assets/Game_Graphics/maps/Office/Map010.json';
import TilesetsData from '../../assets/Game_Graphics/maps/Tilesets.json';
import MallTilesetsData from '../../assets/Game_Graphics/maps/Mall_Tilesets.json';
import MallFloorTilesetsData from '../../assets/Game_Graphics/maps/Mall/Tilesets.json';
import SchoolTilesetsData from '../../assets/Game_Graphics/maps/School/Tilesets.json';
import OfficeTilesetsData from '../../assets/Game_Graphics/maps/Office/Tilesets.json';

/**
 * Tiny binary min-heap of integer payloads ordered by a numeric priority.
 * Used as the A* open set so node selection stays O(log n) on large grids
 * instead of the O(n) linear scan a plain array would need.
 *
 * Two parallel arrays (payloads + priorities) avoid per-node object churn.
 */
class MinHeap {
  constructor() {
    this.items = []; // payloads (tile indices)
    this.prio = [];  // matching priorities (fScores)
    this.size = 0;
  }

  push(item, priority) {
    const n = this.size++;
    this.items[n] = item;
    this.prio[n] = priority;
    this._siftUp(n);
  }

  pop() {
    const { items, prio } = this;
    const top = items[0];
    const last = --this.size;
    if (last > 0) {
      items[0] = items[last];
      prio[0] = prio[last];
      this._siftDown(0);
    }
    return top;
  }

  _siftUp(n) {
    const { items, prio } = this;
    const item = items[n];
    const p = prio[n];
    while (n > 0) {
      const parent = (n - 1) >> 1;
      if (prio[parent] <= p) break;
      items[n] = items[parent];
      prio[n] = prio[parent];
      n = parent;
    }
    items[n] = item;
    prio[n] = p;
  }

  _siftDown(n) {
    const { items, prio } = this;
    const size = this.size;
    const item = items[n];
    const p = prio[n];
    const half = size >> 1;
    while (n < half) {
      let child = 2 * n + 1;
      const right = child + 1;
      if (right < size && prio[right] < prio[child]) child = right;
      if (prio[child] >= p) break;
      items[n] = items[child];
      prio[n] = prio[child];
      n = child;
    }
    items[n] = item;
    prio[n] = p;
  }
}

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
      
      // Mall map (legacy Map003 - kept for backward compatibility)
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

      // Mall 1st Floor (Map006)
      if (mapId === 'mall_1f') {
        this.mapData = Map006Data.data;
        this.mapWidth = Map006Data.width;
        this.mapHeight = Map006Data.height;

        const mall1fTileset = MallFloorTilesetsData.find(t => t && t.id === 5);
        if (mall1fTileset) {
          this.tilesetFlags = mall1fTileset.flags;
        } else {
          console.error('Tileset ID 5 (Mall 1st Floor) not found');
          this.tilesetFlags = [];
        }

        console.log(`✅ Collision system initialized for MALL 1F: ${this.mapWidth}x${this.mapHeight} tiles`);
        console.log(`   Loaded ${this.tilesetFlags.length} tile flags`);
        this.initialized = true;
        return true;
      }

      // Mall 2nd Floor (Map007)
      if (mapId === 'mall_2f') {
        this.mapData = Map007Data.data;
        this.mapWidth = Map007Data.width;
        this.mapHeight = Map007Data.height;

        const mall2fTileset = MallFloorTilesetsData.find(t => t && t.id === 6);
        if (mall2fTileset) {
          this.tilesetFlags = mall2fTileset.flags;
        } else {
          console.error('Tileset ID 6 (Mall 2nd Floor) not found');
          this.tilesetFlags = [];
        }

        console.log(`✅ Collision system initialized for MALL 2F: ${this.mapWidth}x${this.mapHeight} tiles`);
        console.log(`   Loaded ${this.tilesetFlags.length} tile flags`);
        this.initialized = true;
        return true;
      }

      // Mall 3rd Floor (Map008)
      if (mapId === 'mall_3f') {
        this.mapData = Map008Data.data;
        this.mapWidth = Map008Data.width;
        this.mapHeight = Map008Data.height;

        const mall3fTileset = MallFloorTilesetsData.find(t => t && t.id === 7);
        if (mall3fTileset) {
          this.tilesetFlags = mall3fTileset.flags;
        } else {
          console.error('Tileset ID 7 (Mall 3rd Floor) not found');
          this.tilesetFlags = [];
        }

        console.log(`✅ Collision system initialized for MALL 3F: ${this.mapWidth}x${this.mapHeight} tiles`);
        console.log(`   Loaded ${this.tilesetFlags.length} tile flags`);
        this.initialized = true;
        return true;
      }

      // Office map (Map010)
      if (mapId === 'office') {
        this.mapData = Map010Data.data;
        this.mapWidth = Map010Data.width;
        this.mapHeight = Map010Data.height;

        const officeTileset = OfficeTilesetsData.find(t => t && t.id === 8);
        if (officeTileset) {
          this.tilesetFlags = officeTileset.flags;
        } else {
          console.error('Tileset ID 8 (Office) not found');
          this.tilesetFlags = [];
        }

        console.log(`✅ Collision system initialized for OFFICE: ${this.mapWidth}x${this.mapHeight} tiles`);
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
   * Get all tile IDs at the specified tile coordinates across all layers
   */
  getAllTileIds(x, y) {
    const tileIds = [];

    if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
      return tileIds;
    }

    const baseIndex = this.coordsToIndex(x, y);
    const layerSize = this.mapWidth * this.mapHeight;
    const numLayers = Math.floor(this.mapData.length / layerSize);

    for (let layer = 0; layer < numLayers; layer++) {
      const index = baseIndex + (layer * layerSize);
      const tileId = this.mapData[index];
      if (tileId && tileId > 0) {
        tileIds.push(tileId);
      }
    }

    return tileIds;
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
   * RPG Maker MZ checks ALL layers - if ANY layer has a non-passable tile,
   * the position is blocked. This matches RPG Maker MZ's actual behavior
   * where placing an impassable tile on any layer blocks the tile.
   */
  isPassable(x, y) {
    // Out of bounds = not passable
    if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
      return false;
    }

    const baseIndex = this.coordsToIndex(x, y);
    const layerSize = this.mapWidth * this.mapHeight;
    const numLayers = Math.floor(this.mapData.length / layerSize);

    // Check ALL layers - if any layer has a blocking tile, it's not passable
    for (let layer = 0; layer < numLayers; layer++) {
      const index = baseIndex + (layer * layerSize);
      const tileId = this.mapData[index];

      if (tileId && tileId > 0) {
        const flag = this.getTileFlag(tileId);
        // If this layer's tile has directional blocking bits set, block movement
        if ((flag & 0x000F) !== 0) {
          return false;
        }
      }
    }

    return true;
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
   *
   * Checks ALL layers - if any layer blocks the direction, it's blocked.
   */
  isDirectionBlocked(x, y, direction) {
    if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
      return true;
    }

    const directionBits = {
      'down': 0x0001,  // Bit 0
      'left': 0x0002,  // Bit 1
      'right': 0x0004, // Bit 2
      'up': 0x0008     // Bit 3
    };

    const baseIndex = this.coordsToIndex(x, y);
    const layerSize = this.mapWidth * this.mapHeight;
    const numLayers = Math.floor(this.mapData.length / layerSize);

    for (let layer = 0; layer < numLayers; layer++) {
      const index = baseIndex + (layer * layerSize);
      const tileId = this.mapData[index];

      if (tileId && tileId > 0) {
        const flag = this.getTileFlag(tileId);
        if ((flag & directionBits[direction]) !== 0) {
          return true;
        }
      }
    }

    return false;
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
   * Find a walkable path between two TILE coordinates using A* search.
   *
   * Returns an ordered array of tile steps from the tile AFTER the start up
   * to and including the target: [{ x, y }, ...]. The start tile is omitted
   * (it's where the character already is). Returns [] when no path exists,
   * when start === target, or when the target is unreachable/blocked.
   *
   * Movement is 4-directional and obeys the SAME rules the character moves
   * by, so every returned step is actually traversable:
   *   - destination tile must be passable (isPassable)
   *   - source tile must not block exit in that direction (isDirectionBlocked)
   *   - optional isBlocked(x, y) veto for transient occupants (e.g. NPCs),
   *     keeping this module decoupled from game state.
   *
   * A* with a Manhattan heuristic + binary-heap open set keeps this cheap
   * enough to run synchronously on a tap without stalling the JS thread,
   * and maxNodes hard-caps the work so a pathological map can never freeze it.
   *
   * @param {number} startX  start tile X
   * @param {number} startY  start tile Y
   * @param {number} targetX target tile X
   * @param {number} targetY target tile Y
   * @param {object} [options]
   * @param {(x:number, y:number) => boolean} [options.isBlocked] extra per-tile veto
   * @param {number} [options.maxNodes] safety cap on explored nodes (default 5000)
   * @param {boolean} [options.fallbackToClosest] when the exact target can't be
   *   reached, return the route to the closest reachable tile instead of []
   *   (so the character walks as far as it can — visible input feedback).
   *   The endpoint may not be the requested target; callers should compare.
   * @returns {Array<{x: number, y: number}>}
   */
  findPath(startX, startY, targetX, targetY, options = {}) {
    if (!this.initialized) return [];

    const { isBlocked, maxNodes = 5000, fallbackToClosest = false } = options;

    // Already there.
    if (startX === targetX && startY === targetY) return [];

    // Can we stand on the exact target tile? (off-map / wall / NPC => no)
    const targetReachable =
      targetX >= 0 && targetX < this.mapWidth &&
      targetY >= 0 && targetY < this.mapHeight &&
      this.isPassable(targetX, targetY) &&
      !(isBlocked && isBlocked(targetX, targetY));

    // Exact target unreachable and caller doesn't want a partial route:
    // preserve the original contract and bail before searching.
    if (!targetReachable && !fallbackToClosest) return [];

    const W = this.mapWidth;
    const H = this.mapHeight;
    const size = W * H;

    // Flat typed arrays keyed by tile index — far cheaper than a Map of objects.
    const gScore = new Float64Array(size).fill(Infinity);
    const cameFrom = new Int32Array(size).fill(-1);
    const closed = new Uint8Array(size);

    const startIdx = startY * W + startX;
    // Only match an in-bounds, standable target; -1 disables the equality test
    // so an off-map tap still searches and (with fallback) walks closest.
    const targetIdx = targetReachable ? targetY * W + targetX : -1;
    gScore[startIdx] = 0;

    const heuristic = (x, y) => Math.abs(x - targetX) + Math.abs(y - targetY);

    const open = new MinHeap();
    open.push(startIdx, heuristic(startX, startY));

    // Best (closest-to-target) tile actually reached, for the partial fallback.
    // Seeded with the start so a fully boxed-in start yields no movement.
    let bestIdx = startIdx;
    let bestH = heuristic(startX, startY);
    let bestG = 0;

    // 4-neighbour offsets paired with the direction name used to check
    // whether leaving the SOURCE tile that way is blocked.
    const NEIGHBORS = [
      { dx: 0, dy: -1, dir: 'up' },
      { dx: 0, dy: 1, dir: 'down' },
      { dx: -1, dy: 0, dir: 'left' },
      { dx: 1, dy: 0, dir: 'right' },
    ];

    let explored = 0;

    while (open.size > 0) {
      const currentIdx = open.pop();

      if (currentIdx === targetIdx) {
        return this._reconstructPath(cameFrom, startIdx, targetIdx, W);
      }

      // Lazy deletion: stale heap entries (re-pushed with a better cost) skipped.
      if (closed[currentIdx]) continue;
      closed[currentIdx] = 1;

      if (++explored > maxNodes) break; // never freeze the JS thread

      const cx = currentIdx % W;
      const cy = (currentIdx - cx) / W;
      const baseG = gScore[currentIdx];

      // Track the closest reachable tile (min heuristic; ties -> shorter walk).
      const cH = heuristic(cx, cy);
      if (cH < bestH || (cH === bestH && baseG < bestG)) {
        bestH = cH;
        bestG = baseG;
        bestIdx = currentIdx;
      }

      for (let i = 0; i < NEIGHBORS.length; i++) {
        const { dx, dy, dir } = NEIGHBORS[i];
        const nx = cx + dx;
        const ny = cy + dy;

        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;

        const nIdx = ny * W + nx;
        if (closed[nIdx]) continue;

        // Same gate the walker uses, so the path is guaranteed traversable.
        if (!this.isPassable(nx, ny)) continue;
        if (this.isDirectionBlocked(cx, cy, dir)) continue;
        if (isBlocked && isBlocked(nx, ny)) continue;

        const tentativeG = baseG + 1;
        if (tentativeG < gScore[nIdx]) {
          gScore[nIdx] = tentativeG;
          cameFrom[nIdx] = currentIdx;
          open.push(nIdx, tentativeG + heuristic(nx, ny));
        }
      }
    }

    // Exact target never reached. Walk to the closest tile we got to so the
    // tap still produces visible movement; [] only if start was already it.
    if (fallbackToClosest && bestIdx !== startIdx) {
      return this._reconstructPath(cameFrom, startIdx, bestIdx, W);
    }

    return []; // no route
  }

  /**
   * Walk cameFrom links target -> start and return the forward tile steps,
   * excluding the start tile. Internal helper for findPath.
   */
  _reconstructPath(cameFrom, startIdx, targetIdx, W) {
    const path = [];
    let cur = targetIdx;
    while (cur !== startIdx && cur !== -1) {
      const x = cur % W;
      const y = (cur - x) / W;
      path.push({ x, y });
      cur = cameFrom[cur];
    }
    path.reverse();
    return path;
  }

  /**
   * Get collision info for debugging
   */
  getTileInfo(x, y) {
    const tileIds = this.getAllTileIds(x, y);
    const topTileId = this.getTileId(x, y);
    const topFlag = this.getTileFlag(topTileId);

    // Build per-layer info
    const layerInfo = tileIds.map(tileId => {
      const flag = this.getTileFlag(tileId);
      return {
        tileId,
        flag,
        flagBinary: flag.toString(2).padStart(16, '0'),
        blocking: (flag & 0x000F) !== 0
      };
    });

    return {
      x,
      y,
      tileId: topTileId,
      allTileIds: tileIds,
      flag: topFlag,
      flagBinary: topFlag.toString(2).padStart(16, '0'),
      passable: this.isPassable(x, y),
      blockedDown: this.isDirectionBlocked(x, y, 'down'),
      blockedLeft: this.isDirectionBlocked(x, y, 'left'),
      blockedRight: this.isDirectionBlocked(x, y, 'right'),
      blockedUp: this.isDirectionBlocked(x, y, 'up'),
      layerInfo
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
