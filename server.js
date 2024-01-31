const express = require('express');
const WebSocket = require('ws');
const wss = new WebSocket.Server({
    port: 9206
});
const http = require('http');
const { spawn } = require('child_process');
const app = express();
app.use(express.static('client'));
const server = http.createServer(app);
server.listen(8080, function () {
    console.log('Listening on http://localhost:8080');
});
const gameState = {
    type: "gameState",
    players: []
};
const level = {
    levelObjects: [{
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        type: "stone"
    }, {
        x: 300,
        y: 100,
        width: 300,
        height: 100,
        type: "wall"
    }]
};
const playerSpawnPoints = [{
    x: 10,
    y: 10
}, {
    x: 220,
    y: 125
}, {
    x: 20,
    y: 230
}];

const playerSpeed = 5;
const bulletSpeed = 10;
const flightDistance = 200;
const frameDuration = 16;
const playerSize = 50;
const bulletSize = 2;
const gunOffset = 33;
const gunOffsetShort = 13;
const flightDistanceDiag = Math.cos(45 * Math.PI / 180) * flightDistance;
let playerCounter = 1;
function distributeMessage(message) {
    const messageString = JSON.stringify(message);
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
}
function distributeState() {
    distributeMessage(gameState);
}
wss.on('connection', function connection(ws) {
    const playerId = `player${playerCounter}`;
    function sendMessage(message) {
        ws.send(JSON.stringify(message));
    }
    sendMessage({
        type: "currentPlayerId",
        playerId: playerId
    });
    sendMessage({
        type: "level",
        level: level
    });
    function setSpawnPoint(player) {
        do {
            const randomNumber = Math.floor(Math.random() * (playerSpawnPoints.length));
            let spawnPoint = playerSpawnPoints[randomNumber];
            spawnPoint.height = playerSize;
            spawnPoint.width = playerSize;
            if (playerHitCalculation(spawnPoint)) {
                console.log("spawn point conflict: " + JSON.stringify(spawnPoint));
                continue;
            }
            player.x = spawnPoint.x;
            player.y = spawnPoint.y;
            return;
        } while (true);
    }
    const currentPlayer = {
        id: playerId,
        width: playerSize,
        height: playerSize,
        aimDirection: "right",
        kills: 0,
        deaths: 0
    };
    setSpawnPoint(currentPlayer);
    playerCounter += 1;
    gameState.players.push(currentPlayer);
    distributeState();
    distributeScore();

    ws.on('error', console.error);
    function distributeScore() {
        const score = gameState.players.map(player => {
            return {
                id: player.id,
                kills: player.kills,
                deaths: player.deaths,
                score: player.kills - player.deaths
            }
        });
        score.sort((a, b) => b.score - a.score);
        distributeMessage({
            type: "score",
            score
        });
    }
    function movePlayer(moveDirection) {
        //console.log(JSON.stringify(currentPlayer));
        let newX = currentPlayer.x;
        let newY = currentPlayer.y;

        switch (moveDirection) {
            case "down":
                newY += playerSpeed;
                break;
            case "up":
                if (newY > 0) {
                    newY -= playerSpeed;
                }
                break;
            case "left":
                newX -= playerSpeed;
                break;
            case "right":
                newX += playerSpeed;
                break;
            case "down-right":
                newY += playerSpeed;
                newX += playerSpeed;
                break;
            case "down-left":
                newY += playerSpeed;
                newX -= playerSpeed;
                break;
            case "up-right":
                newY -= playerSpeed;
                newX += playerSpeed;
                break;
            case "up-left":
                newY -= playerSpeed;
                newX -= playerSpeed;
                break;

            default:
                break;
        }
        const newPlayerPosition = {
            x: newX,
            y: newY,
            width: currentPlayer.width,
            height: currentPlayer.height
        };
        let hitObstackle = false;
        for (const levelObject of level.levelObjects) {
            if (hitCalculation(newPlayerPosition, levelObject)) {
                hitObstackle = true;
                break;
            }
        }
        if (playerHitCalculation(currentPlayer)) {
            hitObstackle = true;
        }
        if (hitObstackle == false) {
            currentPlayer.x = newX;
            currentPlayer.y = newY;
        }
        currentPlayer.aimDirection = moveDirection;
        distributeState();
    }
    function moveBullet(bullet) {
        let flightEnded = false;
        console.log(`move bullet: ${JSON.stringify(bullet)}`);
        if (bullet.flightDirection == "up") {
            bullet.y -= bullet.bulletSpeed;
            if (bullet.y <= bullet.bulletTargetY) {
                flightEnded = true;
            }
        } else if (bullet.flightDirection == "down") {
            bullet.y += bullet.bulletSpeed;
            if (bullet.y >= bullet.bulletTargetY) {
                flightEnded = true;
            }
        } else if (bullet.flightDirection == "left") {
            bullet.x -= bullet.bulletSpeed;
            if (bullet.x <= bullet.bulletTargetX) {
                flightEnded = true;
            }
        } else if (bullet.flightDirection == "right") {
            bullet.x += bullet.bulletSpeed;
            if (bullet.x >= bullet.bulletTargetX) {
                flightEnded = true;
            }
        } else if (bullet.flightDirection == "down-right") {
            bullet.x += bullet.bulletSpeed;
            bullet.y += bullet.bulletSpeed;
            if (bullet.x >= bullet.bulletTargetX && bullet.y >= bullet.bulletTargetY) {
                flightEnded = true;
            }
        } else if (bullet.flightDirection == "down-left") {
            bullet.x -= bullet.bulletSpeed;
            bullet.y += bullet.bulletSpeed;
            if (bullet.x <= bullet.bulletTargetX && bullet.y >= bullet.bulletTargetY) {
                flightEnded = true;
            }
        } else if (bullet.flightDirection == "up-right") {
            bullet.x += bullet.bulletSpeed;
            bullet.y -= bullet.bulletSpeed;
            if (bullet.x >= bullet.bulletTargetX && bullet.y <= bullet.bulletTargetY) {
                flightEnded = true;
            }
        } else if (bullet.flightDirection == "up-left") {
            bullet.x -= bullet.bulletSpeed;
            bullet.y -= bullet.bulletSpeed;
            if (bullet.x <= bullet.bulletTargetX && bullet.y <= bullet.bulletTargetY) {
                flightEnded = true;
            }
        }
        if (bulletHitCalculation(bullet)) {
            return;
        }
        if (flightEnded == false) {
            setTimeout(() => moveBullet(bullet), bullet.frameDuration);
        }
    }
    function getBounds(obj) {
        return {
            left: obj.x,
            right: obj.x + obj.width,
            top: obj.y,
            bottom: obj.y + obj.height
        };
    }
    function hitCalculation(obj1, obj2) {
        const obj1Bounds = getBounds(obj1);
        const obj2Bounds = getBounds(obj2);
        const hit = !(obj1Bounds.top > obj2Bounds.bottom ||
            obj1Bounds.right < obj2Bounds.left ||
            obj1Bounds.bottom < obj2Bounds.top ||
            obj1Bounds.left > obj2Bounds.right);
        // console.log(`hit calculation result : ${hit} details: ${JSON.stringify(obj1Bounds)} and ${JSON.stringify(obj2Bounds)}`)
        return hit;
    }
    function playerHitCalculation(target) {
        for (const player of gameState.players) {
            if (player == currentPlayer) {
                continue;
            }
            if (hitCalculation(target, player)) {
                return true;
            }
        }
    }
    function bulletHitCalculation(bullet) {
        for (const player of gameState.players) {
            if (player == currentPlayer) {
                continue;
            }
            if (hitCalculation(bullet, player)) {
                console.log(`hit: ${player.id}`);
                distributeMessage({
                    type: "hit",
                    victim: player.id
                });
                player.deaths += 1;
                const shooter = gameState.players.find(p => p.id == bullet.shooterId);
                shooter.kills += 1;
                setSpawnPoint(player);
                distributeState();
                distributeScore();
                return true;
            }
        }
        for (const levelObject of level.levelObjects) {
            if (hitCalculation(bullet, levelObject)) {
                return true;
            }

        }
    }
    function shoot() {
        let startX = currentPlayer.x;
        let startY = currentPlayer.y;
        let bulletTargetX = startX;
        let bulletTargetY = startY;
        if (currentPlayer.aimDirection == "up") {
            startX += gunOffset;
            bulletTargetY -= flightDistance;
        } else if (currentPlayer.aimDirection == "down") {
            startX += gunOffsetShort;
            bulletTargetY += flightDistance;
        } else if (currentPlayer.aimDirection == "left") {
            startY += gunOffsetShort;
            bulletTargetX -= flightDistance;
        } else if (currentPlayer.aimDirection == "right") {
            startY += gunOffset;
            bulletTargetX += flightDistance + gunOffset;
        } else if (currentPlayer.aimDirection == "down-right") {
            startX -= gunOffsetShort;
            bulletTargetX += flightDistanceDiag;
            bulletTargetY += flightDistanceDiag;
        } else if (currentPlayer.aimDirection == "down-left") {
            startX += gunOffset;
            bulletTargetX -= flightDistanceDiag;
            bulletTargetY += flightDistanceDiag;
        } else if (currentPlayer.aimDirection == "up-right") {
            startX += gunOffset;
            startY += gunOffset;
            bulletTargetX += flightDistanceDiag;
            bulletTargetY -= flightDistanceDiag;
        } else if (currentPlayer.aimDirection == "up-left") {
            startX += gunOffsetShort;
            bulletTargetX -= flightDistanceDiag;
            bulletTargetY -= flightDistanceDiag;
        }
        const message = {
            type: "bullet",
            x: startX,
            y: startY,
            width: bulletSize,
            height: bulletSize,
            flightDirection: currentPlayer.aimDirection,
            bulletSpeed: bulletSpeed,
            shooterId: playerId,
            bulletTargetX: bulletTargetX,
            bulletTargetY: bulletTargetY,
            frameDuration: frameDuration
        };
        moveBullet(message);
        distributeMessage(message);
    }
    ws.on('message', function message(data) {
        // console.log('received: %s', data);
        const command = JSON.parse(data);
        if (command.action == "move") {
            movePlayer(command.moveDirection);
        }
        if (command.action == "shoot") {
            shoot();
        }
        // console.log(JSON.stringify(gameState));
    });
    ws.on('close', function close() {
        const index = gameState.players.indexOf(currentPlayer);
        if (index > -1) {
            gameState.players.splice(index, 1);
        }
        distributeState();
        distributeScore();
    });
});