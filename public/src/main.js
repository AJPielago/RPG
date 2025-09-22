// Game configuration
const CONFIG = {
  debug: true,  // Debug mode enabled by default
  noCollisionTrees: new Set()  // Track trees with disabled collision
};

// Add CSS to center the game canvas
const style = document.createElement('style');
style.textContent = `
  body {
    margin: 0;
    padding: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background-color: #1a1a1a;
    font-family: Arial, sans-serif;
  }
  
  #game-container {
    border: 2px solid #444;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  }
  
  canvas {
    display: block;
    border-radius: 6px;
  }
`;
document.head.appendChild(style);

// Create game container
const gameContainer = document.createElement('div');
gameContainer.id = 'game-container';
document.body.appendChild(gameContainer);

const config = {
  type: Phaser.AUTO,
  width: 1000,  // Increased width to show more of the map
  height: 700,  // Increased height to show more of the map
  parent: 'game-container', // This will center the canvas if you add CSS
  physics: {
    default: "arcade",
    arcade: { 
      gravity: { y: 0 },
      debug: false 
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  },
  backgroundColor: '#2c3e50' // Dark background to see map boundaries
};

const game = new Phaser.Game(config);

let player;
let cursors;
let keys;
let isAttacking = false;
let isHurting = false;
let map;
let assetsTileset;
let tilesTileset;
let backgroundLayer;

function preload() {
  // Load player sprites
  this.load.spritesheet("idle", "images/player/idle.png", { frameWidth: 96, frameHeight: 96 });
  this.load.spritesheet("run", "images/player/run.png", { frameWidth: 96, frameHeight: 96 });
  this.load.spritesheet("attack", "images/player/attack.png", { frameWidth: 96, frameHeight: 96 });
  this.load.spritesheet("hurt", "images/player/hurt.png", { frameWidth: 96, frameHeight: 96 });
  
  // Load tilemap and both tilesets
  this.load.tilemapTiledJSON("map", "map/map.tmj");
  this.load.image("assets", "map/assets.png");   // First tileset
  this.load.image("tiles", "map/tileset.png");   // Second tileset - using tileset.png as the actual file
}

function create() {
  // Create the tilemap
  map = this.make.tilemap({ key: "map" });
  
  // Debug: Log all available information
  console.log("Map tilesets:", map.tilesets.map(ts => ts.name));
  console.log("Map layers:", map.layers.map(l => l.name));
  console.log("Map size:", map.width, "x", map.height);
  console.log("Tile size:", map.tileWidth, "x", map.tileHeight);
  console.log("Map size in pixels:", map.widthInPixels, "x", map.heightInPixels);
  
  // Try to add tilesets with their exact names from the map
  let tilesets = [];
  map.tilesets.forEach(tilesetData => {
    console.log(`Trying to load tileset: ${tilesetData.name}`);
    console.log(`Tileset properties:`, {
      name: tilesetData.name,
      image: tilesetData.image,
      firstgid: tilesetData.firstgid,
      tilewidth: tilesetData.tilewidth,
      tileheight: tilesetData.tileheight,
      tilecount: tilesetData.tilecount,
      columns: tilesetData.columns
    });
    
    // Try to load the tileset with exact tile specifications
    let tileset = map.addTilesetImage(
      tilesetData.name,     // Name in Tiled
      tilesetData.name,     // Image key we loaded
      tilesetData.tilewidth || 32,    // Tile width
      tilesetData.tileheight || 32,   // Tile height
      tilesetData.margin || 0,        // Margin
      tilesetData.spacing || 0        // Spacing
    );
    
    if (tileset) {
      tilesets.push(tileset);
      console.log(`Successfully loaded tileset: ${tilesetData.name}`);
      console.log(`Tileset GID range: ${tileset.firstgid} to ${tileset.firstgid + tileset.total - 1}`);
    } else {
      console.error(`Failed to load tileset: ${tilesetData.name}`);
    }
  });
  
  if (tilesets.length === 0) {
    console.error("No tilesets loaded!");
    return;
  }

  // Create ALL layers from your map
  console.log("Creating all map layers...");
  let layers = {};
  
  // Create layers in the correct order
  const layerNames = ["Ground", "Fences", "Trees", "Logs", "Bridges"];
  
  layerNames.forEach(layerName => {
    console.log(`Attempting to create layer: ${layerName}`);
    let layer = map.createLayer(layerName, tilesets);
    if (layer) {
      layers[layerName] = layer;
      layer.setVisible(true);
      console.log(`Successfully created layer: ${layerName}`);
    } else {
      console.error(`Failed to create layer: ${layerName}`);
    }
  });
  
  // Create collision bodies for Trees and Fences manually
  let obstacleGroup = this.physics.add.staticGroup();
  let obstacleCount = 0;
  
  // Enable debug for physics bodies (visible in game)
  // Temporarily disable debug to improve performance
  this.physics.world.createDebugGraphic();
  this.physics.world.drawDebug = true; // Enable physics debug
  
  // Check Trees layer for obstacles
  if (layers["Trees"]) {
    console.log("=== Initializing Tree Collision System ===");
    console.log("Scanning Trees layer...");
    
    // Load saved collision data
    const savedCollision = localStorage.getItem('treeCollision');
    if (savedCollision) {
      try {
        const savedPositions = JSON.parse(savedCollision);
        console.log('Loaded saved collision data:', savedPositions);
        savedPositions.forEach(pos => CONFIG.noCollisionTrees.add(pos));
      } catch (e) {
        console.error('Error loading collision data:', e);
        localStorage.removeItem('treeCollision');
      }
    }

    // Store tile references for collision toggling
    CONFIG.tileColliders = new Map();

    // Process each tree tile
    layers["Trees"].forEachTile(tile => {
      if (tile && tile.index > 0) {
        const posKey = `${tile.x},${tile.y}`;
        const hasCollision = !CONFIG.noCollisionTrees.has(posKey);
        
        // Create a collider for this tile - centered on the tree trunk
        const obstacle = this.add.rectangle(
          tile.pixelX + 16,  // Center of the tile
          tile.pixelY + 40,  // Position at the base of the tree
          20, 24,           // Slightly smaller than tile size
          hasCollision ? 0xff0000 : 0x00ff00, 
          0.5  // Increased alpha for better visibility
        )
        .setOrigin(0.9, 2)  // Anchor at bottom center (since trees are tall)
        .setDepth(1000)     // Make sure debug rectangles are on top
        .setVisible(CONFIG.debug);
        
        // Store reference to this collider
        const colliderData = { 
          obstacle, 
          hasCollision,
          body: null
        };
        
        // Only add physics if collision is enabled
        if (hasCollision) {
          // Create an invisible sprite for the physics body at the tree base
          const physicsSprite = this.add.rectangle(
            tile.pixelX + 16,  // Center of the tile
            tile.pixelY + 16,  // Center of the tile
            28, 28,           // Slightly smaller than tile size for better feel
            0x0000ff,         // Blue for debugging (invisible in production)
            CONFIG.debug ? 0.3 : 0  // Only visible in debug mode
          )
          .setOrigin(0.5, 0.5)  // Center the origin
          .setDepth(9999);      // Ensure it's on top
          
          // Add physics to the sprite
          this.physics.add.existing(physicsSprite);
          physicsSprite.body.setSize(24, 24, true);  // Smaller than tile for better feel
          physicsSprite.body.setImmovable(true);
          physicsSprite.body.allowGravity = false;
          physicsSprite.body.debugShowBody = CONFIG.debug;
          physicsSprite.body.onCollide = true;  // Enable collision callbacks
          
          // Enable physics debug
          if (CONFIG.debug) {
            physicsSprite.setVisible(true);
          }
          
          // Store the physics body reference
          colliderData.body = physicsSprite.body;
          obstacleGroup.add(physicsSprite);
          obstacleCount++;
        }
        
        CONFIG.tileColliders.set(posKey, colliderData);

        // Make tree clickable in debug mode
        this.add.zone(tile.pixelX + 16, tile.pixelY + 20, 32, 40)  // Slightly higher click area
          .setInteractive()
          .setOrigin(0.5, 0.5)  // Center the interactive zone
          .on('pointerdown', () => {
            if (!CONFIG.debug) return;
            
            const tileData = CONFIG.tileColliders.get(posKey);
            if (!tileData) return;
            
            if (tileData.hasCollision) {
              // Disable collision
              tileData.obstacle.setFillStyle(0x00ff00, 0.1);
              
              // Remove from physics
              if (tileData.body) {
                // Find and remove the physics sprite from the group
                const physicsSprite = obstacleGroup.getChildren().find(
                  child => child.body === tileData.body
                );
                
                if (physicsSprite) {
                  obstacleGroup.remove(physicsSprite, true, true);
                }
                
                if (tileData.body.gameObject) {
                  tileData.body.gameObject.destroy();
                }
                
                tileData.body.destroy();
                tileData.body = null;
                obstacleCount--;
              }
              
              CONFIG.noCollisionTrees.add(posKey);
              tileData.hasCollision = false;
            } else {
              // Enable collision
              tileData.obstacle.setFillStyle(0xff0000, 0.3);
              
              // Add back to physics
              if (!tileData.body) {
                // Create a new physics body
                const pos = tileData.obstacle;
                const physicsSprite = this.add.rectangle(
                  Math.floor(pos.x / 32) * 32 + 16,  // Snap to tile center X
                  Math.floor(pos.y / 32) * 32 + 16,  // Snap to tile center Y
                  32, 32,                           // Full tile size
                  0x0000ff,                         // Blue for debugging
                  CONFIG.debug ? 0.3 : 0
                )
                .setOrigin(0.5, 0.5);  // Center the origin
                
                // Add physics to the sprite
                this.physics.add.existing(physicsSprite);
                physicsSprite.body.setSize(32, 32, false);  // Full tile size
                physicsSprite.body.setOffset(0, 0);         // No offset needed
                physicsSprite.body.setImmovable(true);
                physicsSprite.body.allowGravity = false;
                physicsSprite.body.debugShowBody = CONFIG.debug;
                
                // Store the physics body reference
                tileData.body = physicsSprite.body;
                obstacleGroup.add(physicsSprite);
                obstacleCount++;
              } else {
                // Re-enable the existing body
                tileData.body.enable = true;
                if (tileData.body.gameObject) {
                  tileData.body.gameObject.setActive(true).setVisible(false);
                }
              }
              
              CONFIG.noCollisionTrees.delete(posKey);
              tileData.hasCollision = true;
            }
            
            // Save to localStorage
            try {
              const collisionArray = Array.from(CONFIG.noCollisionTrees);
              console.log('Updated collisions:', collisionArray);
              localStorage.setItem('treeCollision', JSON.stringify(collisionArray));
            } catch (e) {
              console.error('Error saving collision data:', e);
            }
          });
      }
    });
    
    console.log(`Added collision for ${obstacleCount} trees`);
  }
  
  // Check Fences layer for obstacles
  if (layers["Fences"]) {
    console.log("Scanning Fences layer...");
    layers["Fences"].forEachTile(tile => {
      if (tile && tile.index > 0) {
        // Create a simple physics body for the fence
        let obstacle = this.add.rectangle(
          tile.pixelX + 16, // Center of the tile
          tile.pixelY + 12, // Middle of the tile
          28, 8, // Width, Height - wide but short for fence
          0x00ff00, 0.3 // Green color for debugging
        );
        this.physics.add.existing(obstacle, true);
        obstacleGroup.add(obstacle);
        obstacleCount++;
      }
    });
  }
  
  console.log(`Total obstacles created: ${obstacleCount}`);
  
  // Set backgroundLayer to Ground layer
  backgroundLayer = layers["Ground"] || Object.values(layers)[0];
  
  console.log("Successfully created layers:", Object.keys(layers));
  
  // If you have multiple layers, add them here:
  // groundLayer = map.createLayer("ground", tileset);
  // foregroundLayer = map.createLayer("foreground", tileset);
  
  // Set up collision detection if you have a collision layer
  // backgroundLayer.setCollisionByProperty({ collides: true });
  
  // Scale the tilemap if needed
  // backgroundLayer.setScale(1);

  // Add player as a physics sprite BEFORE setting up camera
  // Initialize keyboard input
  this.input.keyboard.enableGlobalCapture();
  const keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  this.input.keyboard.on('keydown-D', () => {
    CONFIG.debug = !CONFIG.debug;
    console.log('Debug mode:', CONFIG.debug ? 'ON' : 'OFF');
    console.log('Current noCollisionTrees:', Array.from(CONFIG.noCollisionTrees));
  });
  
  // Initialize player
  player = this.physics.add.sprite(400, 300, "idle").setScale(2);
  player.setCollideWorldBounds(true);
  player.play("idle");
  
  // Initialize cursor keys for movement
  cursors = this.input.keyboard.createCursorKeys();
  
  // Configure player's physics body
  player.body.setSize(20, 28, true); // Slightly smaller than character
  player.body.setOffset(38, 36); // Better centered collision box
  
  console.log("Player physics body:", player.body);
  console.log("Player body size:", player.body.width, "x", player.body.height);

  // Create animations
  this.anims.create({
    key: "idle",
    frames: this.anims.generateFrameNumbers("idle", { start: 0, end: 9 }),
    frameRate: 10,
    repeat: -1
  });

  this.anims.create({
    key: "run",
    frames: this.anims.generateFrameNumbers("run", { start: 0, end: 15 }),
    frameRate: 12,
    repeat: -1
  });

  this.anims.create({
    key: "attack",
    frames: this.anims.generateFrameNumbers("attack", { start: 0, end: 6 }),
    frameRate: 12,
    repeat: 0
  });

  this.anims.create({
    key: "hurt",
    frames: this.anims.generateFrameNumbers("hurt", { start: 0, end: 3 }),
    frameRate: 8,
    repeat: 0
  });

  // Set up basic collision between player and obstacles
  if (obstacleGroup) {
    // Configure physics world
    this.physics.world.gravity.y = 0;
    
    // Configure player physics
    player.body.setBounce(0);
    player.body.setCollideWorldBounds(true);
    
    // Configure obstacle physics
    obstacleGroup.getChildren().forEach(obstacle => {
      obstacle.body.setImmovable(true);
      obstacle.body.allowGravity = false;
    });
    
    // Add simple collider
    this.physics.add.collider(player, obstacleGroup, () => {
      // This empty callback ensures the collision is processed
    });
    
    // Add a post-update step to handle any potential overlaps
    this.physics.world.on('worldstep', () => {
      const playerBody = player.body;
      
      // Check for overlaps with all obstacles
      obstacleGroup.getChildren().forEach(obstacle => {
        if (this.physics.world.overlap(playerBody, obstacle.body)) {
          // Simple push out from the obstacle
          if (playerBody.x < obstacle.body.x) {
            player.x = obstacle.body.left - playerBody.width / 2 - 1;
          } else {
            player.x = obstacle.body.right + playerBody.width / 2 + 1;
          }
          
          if (playerBody.y < obstacle.body.y) {
            player.y = obstacle.body.top - playerBody.height / 2 - 1;
          } else {
            player.y = obstacle.body.bottom + playerBody.height / 2 + 1;
          }
          
          // Stop any residual movement
          playerBody.setVelocity(0);
        }
      });
    });
    
    console.log("Added simple collision with obstacle group");
  }
  
  // Optional: You can also add collision with Logs if they should be obstacles
  // if (layers["Logs"]) {
  //   this.physics.add.collider(player, layers["Logs"]);
  // }
  
  // Now that the map is properly sized, use the full map dimensions
  // Set world bounds to match the entire map
  this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  
  // Set camera bounds to the full map
  this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  
  // Calculate zoom to fit the entire map in the window
  let zoomX = 1000 / map.widthInPixels;  
  let zoomY = 700 / map.heightInPixels;   
  let zoom = Math.min(zoomX, zoomY) * 0.85; // Reduced from 0.95 to 0.85 for more zoom out
  
  console.log(`Map size: ${map.widthInPixels}x${map.heightInPixels}`);
  console.log(`Canvas size: 1000x700`);
  console.log(`Zoom: ${zoom.toFixed(3)}`);
  
  this.cameras.main.setZoom(zoom);
  this.cameras.main.centerOn(map.widthInPixels / 2, map.heightInPixels / 2);
  
  // Position player in a grassy area (top-left corner of the map)
  // Using fixed coordinates that should be in a grassy area
  const spawnX = 550;  // Fixed X position in grassy area
  const spawnY = 700;  // Fixed Y position in grassy area
  player.setPosition(spawnX, spawnY);
  console.log(`Player spawned at: ${spawnX}, ${spawnY} (grassy area)`);
  
  // Player collision with world bounds
  player.setCollideWorldBounds(true);
  
  
  // Add camera follow after a delay
  this.time.delayedCall(2000, () => {
    this.cameras.main.startFollow(player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.2); // Reduced from 1.5 to 1.2 for less aggressive zoom when following
  });

  // Controls
  cursors = this.input.keyboard.createCursorKeys();
  keys = this.input.keyboard.addKeys({
    attack: Phaser.Input.Keyboard.KeyCodes.SPACE,
    hurt: Phaser.Input.Keyboard.KeyCodes.H
  });
  
  // Listen for animation complete events
  player.on('animationcomplete', (animation) => {
    if (animation.key === 'attack') {
      isAttacking = false;
    } else if (animation.key === 'hurt') {
      isHurting = false;
    }
  });
}

function update() {
  // Toggle debug mode with 'D' key
  if (cursors.D && Phaser.Input.Keyboard.JustDown(cursors.D)) {
    CONFIG.debug = !CONFIG.debug;
    console.log('Debug mode:', CONFIG.debug ? 'ON' : 'OFF');
    console.log('Current noCollisionTrees:', Array.from(CONFIG.noCollisionTrees));
  }

  // Don't process movement if attacking or hurting
  if (isAttacking || isHurting) {
    player.setVelocity(0);
    return;
  }
  
  player.setVelocity(0);

  // Movement
  if (cursors.left.isDown) {
    player.setVelocityX(-150);
    player.anims.play("run", true);
    player.flipX = true;
  } else if (cursors.right.isDown) {
    player.setVelocityX(150);
    player.anims.play("run", true);
    player.flipX = false;
  } 
  
  if (cursors.up.isDown) {
    player.setVelocityY(-150);
    player.anims.play("run", true);
  } else if (cursors.down.isDown) {
    player.setVelocityY(150);
    player.anims.play("run", true);
  } 
  
  // Stop animation if not moving
  if (cursors.left.isUp && cursors.right.isUp && cursors.up.isUp && cursors.down.isUp) {
    if (!player.anims.isPlaying || player.anims.currentAnim.key !== "idle") {
      player.play("idle");
    }
  }

  // Attack
  if (Phaser.Input.Keyboard.JustDown(keys.attack) && !isAttacking) {
    isAttacking = true;
    player.play("attack");
  }

  // Hurt
  if (Phaser.Input.Keyboard.JustDown(keys.hurt) && !isHurting) {
    isHurting = true;
    player.play("hurt");
  }
}