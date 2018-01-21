var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/js/index.html');
});
app.use(express.static(__dirname + '/js'));
app.use('/assets', express.static(__dirname + '/assets'));

// process.env -> 서버의 환경변수 이용
server.listen(process.env.PORT || 3002);
console.log('Server started');

var MAX_MONSTER = 1;
var playerList = [];
var playerBulletArr = [];
var monsterList = [];
var monsterBulletArr = [];
var monsterNum = 0; // 몬스터 수 제한 할때 필요
var direction = 1; // 몬스터 오른쪽 왼쪽으로 움직임 바꿀때 필요 - monsterMove 메시지 발송시 사용
var n = 0; // 몬스터 미사일 movement에 사용

// objects
var MonsterShip = function (startX, startY) {
    this.x = startX;
    this.y = startY;
}

var MonsterBullet = function (startX, startY) {
    this.x = startX;
    this.y = startY;
}

var Player = function (startX, startY) {
    this.x = startX;
    this.y = startY;
}

io.on('connection', function (socket) {
    console.log('a new player connected ' + socket.id);
    socket.on('new-player', onNewPlayer);
    socket.on('move-player', onMovePlayer);
    socket.on('player-fire', onEnemyFire);
    socket.on('disconnect', onClientDisconnect);
    setInterval(serverGameLoop, 200);
});

/***** functions start *****/
function onNewPlayer(data) {
    var newPlayer = new Player(data.x, data.y);
    newPlayer.id = this.id;
    var currentInfo = {
        id: newPlayer.id,
        x: newPlayer.x,
        y: newPlayer.y
    };

    for (var i = 0; i < playerList.length; i++) {
        var existingPlayer = playerList[i];
        var playerInfo = {
            id: existingPlayer.id,
            x: existingPlayer.x,
            y: existingPlayer.y
        };
        this.emit('new-enemy-player', playerInfo);
    }
    this.broadcast.emit('new-enemy-player', currentInfo);
    io.emit('new-monster', monsterList);
    playerList.push(newPlayer);
}

function onMovePlayer(data) {
    if (findPlayerId(this.id)) {
        var movePlayer = findPlayerId(this.id);
        movePlayer.x = data.x;
        movePlayer.y = data.y;
        var movePlayerData = {
            id: movePlayer.id,
            x: movePlayer.x,
            y: movePlayer.y
        }
        this.broadcast.emit('enemy-move', movePlayerData);
    }
}

function findPlayerId(id) {
    for (var i = 0; i < playerList.length; i++) {
        if (playerList[i].id == id) {
            return playerList[i];
        }
    }
}

function onClientDisconnect() {
    console.log('disconnected');

    var removePlayer = findPlayerId(this.id);

    if (removePlayer) {
        playerList.splice(playerList.indexOf(removePlayer), 1);
    }

    this.broadcast.emit('remove-player', {
        id: this.id
    });
}

function onEnemyFire(datas) {
    var newBullet = datas;
    newBullet.ownerId = this.id;
    playerBulletArr.push(newBullet);
}

function onMonsterCreate() {
    var newMonster = new MonsterShip(Math.floor(Math.random() * 700) + 1, Math.floor(Math.random() * 400) + 1);

    monsterList.push(newMonster);
    io.emit('new-monster', monsterList);
}

/* not used */
function monsterMove() {
        for (var i = 0; i < monsterList.length; i++) {
            var monster = monsterList[i];
            monster.x += 20 * direction;
            
            if (monster.x >= 784) {
                direction = -1;
                monster.y += 10;
            } else if (monster.x <= 0) {
                direction = 1;
                monster.y += 10;
            }
            
            if (monster.y > 500) {
                monster.y = 0;
                monster.x = 400;
            }
            //console.log(monsterList);
            io.emit('monster-move', monsterList);
        }
}

function createMonsterBullet() {
    for (var i = 0; i < monsterList.length; i++) {
            var monsterBullet = new MonsterBullet(monsterList[i].x, monsterList[i].y);
            monsterBullet.speedX = Math.cos(n) * 5;
            monsterBullet.speedY = Math.sin(n) * 5;
            monsterBulletArr.push(monsterBullet);
        }
        n++;
}

function monsterBulletUpdate() {
    for (var i = 0; i < monsterBulletArr.length; i++) {
        var mbullet = monsterBulletArr[i];
        mbullet.x += mbullet.speedX;
        mbullet.y += mbullet.speedY;
        for (var j = 0; j < playerList.length; j++) {
            // 몬스터 미사일과 플레이어간의 거리 계산
            if (mbullet.ownerId != playerList[j].id) {
                var dx = playerList[j].x - mbullet.x;
                var dy = playerList[j].y - mbullet.y;
                var dist = Math.sqrt(dx * dx + dy * dy);

                // 거리가 30보다 작으면 playerHit 메시지 전송
                if (dist < 30) {
                    io.emit('player-hit', playerList[j].id);
                    playerList.splice(j, 1);
                    j--;
                }
            }
        }

        // 몬스터 미사일이 화면 밖으로 나가면 삭제
        if (mbullet.x < 0 || mbullet.x > 800 || mbullet.y < 0 || mbullet.y > 500) {
            monsterBulletArr.splice(i, 1);
            i--;
        }
    }
}

function playerBulletUpdate() {
    for (var i = 0; i < playerBulletArr.length; i++) {
        var bullet = playerBulletArr[i];
        bullet.x += bullet.speedX;
        bullet.y += bullet.speedY;

        for (var j = 0; j < playerList.length; j++) {

            // 어떤 플레이어의 미사일과 다른 플레이어간 거리 계산
            if (bullet.ownerId != playerList[j].id) {
                var dx = playerList[j].x - bullet.x;
                var dy = playerList[j].y - bullet.y;
                var dist = Math.sqrt(dx * dx + dy * dy);

                // 다른 플레이어와의 거리가 10 미만이면 playerHit 메시지 전송
                if (dist < 10) {
                    io.emit('player-hit', playerList[j].id);
                    playerList.splice(j, 1);
                    j--;
                }
            }
        }
        // 플레이어 미사일이 화면 밖으로 나가면 삭제
        if (bullet.x < 0 || bullet.x > 800 || bullet.y < 0 || bullet.y > 500) {
            playerBulletArr.splice(i, 1);
            i--;
        }
    }
}

function serverGameLoop() {
    

    // 1/100 확률로 MAX_MONSTER 개의 몬스터 생성
    if ((Math.floor(Math.random() * 100) + 1) == 1 && monsterNum < MAX_MONSTER) {
        onMonsterCreate();
        monsterNum++;
    }
    // monsterMove();

    // 1/5 확률로 몬스터 미사일 생성
    if ((Math.floor(Math.random() * 5) + 1) == 1) {
        createMonsterBullet();
    }
    
    monsterBulletUpdate();
    io.emit('monster-bullets-update', monsterBulletArr);

    playerBulletUpdate();
    io.emit('player-bullets-update', playerBulletArr);
}

/***** functions end *****/

