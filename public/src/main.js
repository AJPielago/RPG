const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
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
  }
};

const game = new Phaser.Game(config);

let player;
let cursors;
let keys;
let isAttacking = false;
let isHurting = false;

function preload() {
  this.load.spritesheet("idle", "images/player/idle.png", { frameWidth: 96, frameHeight: 96 });
  this.load.spritesheet("run", "images/player/run.png", { frameWidth: 96, frameHeight: 96 });
  this.load.spritesheet("attack", "images/player/attack.png", { frameWidth: 96, frameHeight: 96 });
  this.load.spritesheet("hurt", "images/player/hurt.png", { frameWidth: 96, frameHeight: 96 });
}

function create() {
  // Idle animation
  this.anims.create({
    key: "idle",
    frames: this.anims.generateFrameNumbers("idle", { start: 0, end: 9 }),
    frameRate: 10,
    repeat: -1
  });

  // Run animation
  this.anims.create({
    key: "run",
    frames: this.anims.generateFrameNumbers("run", { start: 0, end: 15 }),
    frameRate: 12,
    repeat: -1
  });

  // Attack animation
  this.anims.create({
    key: "attack",
    frames: this.anims.generateFrameNumbers("attack", { start: 0, end: 6 }),
    frameRate: 12,
    repeat: 0
  });

  // Hurt animation
  this.anims.create({
    key: "hurt",
    frames: this.anims.generateFrameNumbers("hurt", { start: 0, end: 3 }),
    frameRate: 8,
    repeat: 0
  });

  // Add player as a physics sprite
  player = this.physics.add.sprite(400, 300, "idle").setScale(2);
  player.setCollideWorldBounds(true);
  player.play("idle");

  // Controls
  cursors = this.input.keyboard.createCursorKeys();
  keys = this.input.keyboard.addKeys({
    attack: Phaser.Input.Keyboard.KeyCodes.SPACE,
    hurt: Phaser.Input.Keyboard.KeyCodes.H
  });
  
  // Listen for animation complete events
  this.anims.create({
    key: 'temp',
    frames: this.anims.generateFrameNumbers('idle', { start: 0, end: 0 }),
    frameRate: 1
  });
  
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