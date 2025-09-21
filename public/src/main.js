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
  
  // Check Trees layer for obstacles
  if (layers["Trees"]) {
    console.log("Scanning Trees layer...");
    layers["Trees"].forEachTile(tile => {
      // Only create collision for tiles that have actual tree graphics (non-zero, non-empty tile indices)
      if (tile && tile.index > 0) { // Changed from !== -1 to > 0 to avoid empty/background tiles
        // Create VISIBLE collision rectangle for debugging
        let obstacle = this.add.rectangle(
          tile.getCenterX(), 
          tile.getCenterY(), 
          30, 30, // Slightly smaller than tile
          0xff0000, 0.3 // Red color, semi-transparent for debugging
        );
        this.physics.add.existing(obstacle, true); // true = static body
        obstacleGroup.add(obstacle);
        obstacleCount++;
        console.log(`Added tree obstacle at ${tile.x},${tile.y} - tile index: ${tile.index}`);
      }
    });
  }
  
  // Check Fences layer for obstacles
  if (layers["Fences"]) {
    console.log("Scanning Fences layer...");
    layers["Fences"].forEachTile(tile => {
      // Only create collision for tiles that have actual fence graphics
      if (tile && tile.index > 0) { // Changed from !== -1 to > 0 to avoid empty/background tiles
        // Create VISIBLE collision rectangle for debugging
        let obstacle = this.add.rectangle(
          tile.getCenterX(), 
          tile.getCenterY(), 
          30, 30, // Slightly smaller than tile
          0x00ff00, 0.3 // Green color, semi-transparent for debugging
        );
        this.physics.add.existing(obstacle, true); // true = static body
        obstacleGroup.add(obstacle);
        obstacleCount++;
        console.log(`Added fence obstacle at ${tile.x},${tile.y} - tile index: ${tile.index}`);
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
  player = this.physics.add.sprite(400, 300, "idle").setScale(2);
  player.setCollideWorldBounds(true);
  player.play("idle");
  
  // Make sure player has a proper physics body
  player.body.setSize(32, 32); // Set collision box size
  player.body.setOffset(32, 32); // Adjust offset due to scaling
  
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

  // Set up collision between player and tilemap (if you have collision tiles)
  // this.physics.add.collider(player, backgroundLayer);

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
  
  // Position player in the center of the map
  player.setPosition(map.widthInPixels / 2, map.heightInPixels / 2);
  
  // Player collision with world bounds
  player.setCollideWorldBounds(true);
  
  // Add collision between player and obstacle layers
  if (layers["Trees"]) {
    this.physics.add.collider(player, layers["Trees"]);
    console.log("Added collision with Trees layer");
    
    // Debug collision
    layers["Trees"].forEachTile(tile => {
      if (tile.index !== -1) {
        console.log(`Tree tile at ${tile.x},${tile.y} - index: ${tile.index}, collides: ${tile.collides}`);
        return false; // Stop after first tile to avoid spam
      }
    });
  }
  
  if (layers["Fences"]) {
    this.physics.add.collider(player, layers["Fences"]);
    console.log("Added collision with Fences layer");
    
    // Debug collision
    layers["Fences"].forEachTile(tile => {
      if (tile.index !== -1) {
        console.log(`Fence tile at ${tile.x},${tile.y} - index: ${tile.index}, collides: ${tile.collides}`);
        return false; // Stop after first tile to avoid spam
      }
    });
  }
  
  // Optional: You can also add collision with Logs if they should be obstacles
  // if (layers["Logs"]) {
  //   this.physics.add.collider(player, layers["Logs"]);
  // }
  
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