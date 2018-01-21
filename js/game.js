var socket;
socket = io.connect();
var game = new Phaser.Game(800, 500, Phaser.AUTO, document.getElementById('game'));

var enemies = [];
var playerBulletArr = [];
var monsterList = [];
var monsterBulletArr = [];
var isConnected = false;
var backgroundMap;
var playerShip;
var boom;
var j = 0; // 미사일 movement

// object
var main = function () {};

/***** functions start *****/
function onSocketConnected() {
    createPlayer();
    
    isConnected = true;
    socket.emit('new-player', {
        x: playerShip.x,
        y: playerShip.y
    });
}

function createPlayer() {
    var x = Math.floor(Math.random() * 300) + 1;
    var y = Math.floor(Math.random() * 300) + 1;
    playerShip = game.add.sprite(x, y, 'player');
    playerShip.scale.setTo(0.4, 0.4); // set playerShip size
    game.physics.arcade.enable(playerShip); // enable playerShip properties like velocity etc.
    playerShip.body.collideWorldBounds = true; // enable that playerShip hit the game world bound
}


function onRemovePlayer(data) {
    var removePlayer = findPlayerById(data.id);

    if (!removePlayer) {
        return;
    }
    removePlayer.playerShip.destroy();
    enemies.splice(enemies.indexOf(removePlayer), 1);
}

var newPlayer = function (id, startX, startY) {
    this.x = startX;
    this.y = startY;

    this.playerShip = game.add.sprite(this.x, this.y, 'player');
    this.playerShip.id = id;
    this.playerShip.scale.setTo(0.4, 0.4); // set playerShip size
    game.physics.arcade.enable(this.playerShip); // enable playerShip properties like velocity etc.
    this.playerShip.body.collideWorldBounds = true; // enable that playerShip hit the game world bound
}

function onNewPlayer(data) {
    var newEnemy = new newPlayer(data.id, data.x, data.y);
    enemies.push(newEnemy);
}

function onEnemyMove(data) {
    var movePlayer = findPlayerById(data.id);
    if (!movePlayer) {
        return;
    }

    movePlayer.playerShip.x = data.x;
    movePlayer.playerShip.y = data.y;
}

function onPlayerBulletUpdate(serverBulletArr) {
    for (var i = 0; i < serverBulletArr.length; i++) {
        if (playerBulletArr[i] == undefined || playerBulletArr[i].alive == false) {
            playerBulletArr[i] = game.add.sprite(serverBulletArr[i].x, serverBulletArr[i].y, 'enemyBullet');
        } else {
            playerBulletArr[i].x = serverBulletArr[i].x;
            playerBulletArr[i].y = serverBulletArr[i].y;
        }
    }

    for (var j = serverBulletArr.length; j < playerBulletArr.length; j++) {
        playerBulletArr[j].destroy();
        playerBulletArr.splice(j, 1);
        j--;
    }
}

function onPlayerHit(id) {
    if (id == socket.id) {
        if (boom.getFirstExists(false)) {
            var explosion = boom.getFirstExists(false);
            explosion.reset(playerShip.body.x - 70, playerShip.body.y - 70);
            explosion.play('boom', 30, false, true);
        }
        playerShip.kill();
    } else {
        var player = findPlayerById(id);
        if (boom.getFirstExists(false)) {
            var explosion2 = boom.getFirstExists(false);
            explosion2.reset(player.playerShip.body.x - 70, player.playerShip.body.y - 70);
            explosion2.play('boom', 30, false, true);
        }
        player.playerShip.kill();
        for (var i = 0; i < enemies.length; i++) {
            if (player == enemies[i]) {
                enemies.splice(i, 1);
            }
        }
    }
}

var newMonster = function (startX, startY) {
    this.x = startX;
    this.y = startY;

    this.monsterShip = game.add.sprite(this.x, this.y, 'monster');
    game.physics.arcade.enable(this.monsterShip);
}

function onNewMonster(data) {
    for (var i = 0; i < data.length; i++) {
        var newMonsterShip = new newMonster(data[i].x, data[i].y);
        monsterList.push(newMonsterShip);
    }
}

/* not used */
function onMonsterMove(serverMonsterList) {
    for (var i = 0; i < serverMonsterList.length; i++) {
        if (monsterList[i] == undefined) {
            monsterList[i] = game.add.sprite(serverMonsterList[i].x, serverMonsterList[i].y, 'monster');
        } else {
            monsterList[i].x = serverMonsterList[i].x;
            monsterList[i].y = serverMonsterList[i].y;
        }
    }
}

function onMonsterBulletUpdate(serverBulletArr) {
    for (var i = 0; i < serverBulletArr.length; i++) {
        if (monsterBulletArr[i] == undefined) {
            monsterBulletArr[i] = game.add.sprite(serverBulletArr[i].x, serverBulletArr[i].y, 'playerBullet');
        } else {
            monsterBulletArr[i].x = serverBulletArr[i].x;
            monsterBulletArr[i].y = serverBulletArr[i].y;
        }
    }

    for (var j = serverBulletArr.length; j < monsterBulletArr.length; j++) {
        monsterBulletArr[j].destroy();
        monsterBulletArr.splice(j, 1);
        j--;
    }
}

function findPlayerById(id) {
    for (var i = 0; i < enemies.length; i++) {
        if (enemies[i].playerShip.id == id) {
            return enemies[i];
        }
    }
}
/***** functions end *****/

/***** main object prototype start *****/
main.prototype = {
    preload: function () {
        game.stage.disableVisibilityChange = true;
        game.load.image('background', 'assets/starfield.png');
        game.load.image('player', 'assets/player.png');
        game.load.image('playerBullet', 'assets/bullet.png');
        game.load.image('monster', 'assets/invader.png');
        game.load.image('enemyBullet', 'assets/enemy-bullet.png');
        game.load.spritesheet('boom', 'assets/explode.png', 128, 128);
    },

    create: function () {
        backgroundMap = game.add.tileSprite(0, 0, 800, 500, 'background');
        game.physics.enable(backgroundMap, Phaser.Physics.ARCADE);
        // backgroundMap.body.collideWorldBounds = true;
        // backgroundMap.body.immovable = true;

        // explosion sprite group
        boom = game.add.group();
        boom.createMultiple(100, 'boom');
        boom.forEach(function (explosion) {
            explosion.animations.add('boom');
        });

        // socket.on listener
        onSocketConnected();
        socket.on('new-enemy-player', onNewPlayer);
        socket.on('enemy-move', onEnemyMove);
        socket.on('player-hit', onPlayerHit);
        socket.on('player-bullets-update', onPlayerBulletUpdate);
        socket.on('new-monster', onNewMonster);
        // socket.on('monster-move', onMonsterMove);
        socket.on('monster-bullets-update', onMonsterBulletUpdate);
        socket.on('remove-player', onRemovePlayer);
    },

    update: function () {
        if (isConnected) {
            var respawn = game.input.keyboard.addKey(Phaser.Keyboard.ENTER);
            if (playerShip.alive) {
                var fire = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
                var cursors = game.input.keyboard.createCursorKeys();

                playerShip.body.velocity.x = 0;
                playerShip.body.velocity.y = 0;
                if (cursors.left.isDown) {
                    playerShip.body.velocity.x = -200;
                    socket.emit('move-player', {
                        x: playerShip.body.x,
                        y: playerShip.body.y
                    });
                } else if (cursors.right.isDown) {
                    playerShip.body.velocity.x = +200;
                    socket.emit('move-player', {
                        x: playerShip.body.x,
                        y: playerShip.body.y
                    });
                } else if (cursors.up.isDown) {
                    playerShip.body.velocity.y = -200;
                    socket.emit('move-player', {
                        x: playerShip.body.x,
                        y: playerShip.body.y
                    });
                } else if (cursors.down.isDown) {
                    playerShip.body.velocity.y = +200;
                    socket.emit('move-player', {
                        x: playerShip.body.x,
                        y: playerShip.body.y
                    });
                }

                // playerShip fire Bullet key input
                if (fire.isDown) {
                    var speedX = Math.cos(j) * 5;
                    var speedY = Math.sin(j) * 5;
                    socket.emit('player-fire', {
                        x: playerShip.x,
                        y: playerShip.y,
                        speedX: speedX,
                        speedY: speedY
                    });
                    j++;
                    if (j >= 20) j = 0;
                }
            } else if (playerShip.alive == false) {
                if (respawn.isDown) {
                    playerShip.reset(game.world.centerX, game.world.centerY);
                    playerShip.revive();
                    socket.emit('new-player', {
                        x: playerShip.x,
                        y: playerShip.y
                    });
                }
            }
        }
    }
}
/***** main object prototype end *****/


/***** game state start *****/
var gameBootstrapper = {
    init: function () {
        game.state.add('main', main);
        game.state.start('main');
    }
};

gameBootstrapper.init("game");
/***** game state end *****/