const express = require('express');
const WebSocket = require('ws');
const wss = new WebSocket.Server({
    port: 9206
});
const http = require('http');
const app = express();
app.use(express.static('client'));
const server = http.createServer(app);
server.listen(8080, function () {
    console.log('Listening on http://localhost:8080');
});
const gameState = {
    type: "gameState",
    players: []
}
const playerSpeed = 5;
const bulletSpeed = 10;
const flightDistance = 100;
const flightDistanceDiag = Math.cos(45 * Math.PI / 180) * flightDistance;
const frameDuration = 16;
const playerSize = 50;
const bulletSize = 2;
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
    ws.send(JSON.stringify({
        type: "currentPlayerId",
        playerId: playerId
    }));
    const currentPlayer = {
        id: playerId,
        width: playerSize,
        height: playerSize,
        x: 0,
        y: 0,
        aimDirection: "right",
        kills: 0,
        deaths: 0
    };
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
        switch (moveDirection) {
            case "down":
                currentPlayer.y += playerSpeed;
                break;
            case "up":
                currentPlayer.y -= playerSpeed;
                break;
            case "left":
                currentPlayer.x -= playerSpeed;
                break;
            case "right":
                currentPlayer.x += playerSpeed;
                break;
            case "down-right":
                currentPlayer.y += playerSpeed;
                currentPlayer.x += playerSpeed;
                break;
            case "down-left":
                currentPlayer.y += playerSpeed;
                currentPlayer.x -= playerSpeed;
                break;
            case "up-right":
                currentPlayer.y -= playerSpeed;
                currentPlayer.x += playerSpeed;
                break;
            case "up-left":
                currentPlayer.y -= playerSpeed;
                currentPlayer.x -= playerSpeed;
                break;

            default:
                break;
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
        if (hitCalculation(bullet)) {
            return;
        }
        if (flightEnded == false) {
            setTimeout(() => moveBullet(bullet), bullet.frameDuration);
        }
    }
    function hitCalculation(bullet) {
        for (const player of gameState.players) {
            if (player == currentPlayer) {
                continue;
            }
            if (bullet.x >= player.x
                && (bullet.x - bulletSize) <= (player.x + playerSize)
                && bullet.y >= player.y
                && (bullet.y - bulletSize) <= player.y + playerSize) {
                console.log(`hit: ${player.id}`);
                distributeMessage({
                    type: "hit",
                    victim: player.id
                });
                player.deaths += 1;
                const shooter = gameState.players.find(p => p.id == bullet.shooterId);
                shooter.kills += 1;
                player.x = 0;
                player.y = 0;
                distributeState();
                distributeScore();
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
            startX += playerSize;
            bulletTargetY -= flightDistance;
        } else if (currentPlayer.aimDirection == "down") {
            bulletTargetY += flightDistance;
        } else if (currentPlayer.aimDirection == "left") {
            bulletTargetX -= flightDistance;
        } else if (currentPlayer.aimDirection == "right") {
            bulletTargetX += flightDistance;
        } else if (currentPlayer.aimDirection == "down-right") {
            bulletTargetX += flightDistanceDiag;
            bulletTargetY += flightDistanceDiag;
        } else if (currentPlayer.aimDirection == "down-left") {
            bulletTargetX -= flightDistanceDiag;
            bulletTargetY += flightDistanceDiag;
        } else if (currentPlayer.aimDirection == "up-right") {
            bulletTargetX += flightDistanceDiag;
            bulletTargetY -= flightDistanceDiag;
        } else if (currentPlayer.aimDirection == "up-left") {
            bulletTargetX -= flightDistanceDiag;
            bulletTargetY -= flightDistanceDiag;
        }
        const message = {
            type: "bullet",
            x: startX,
            y: startY,
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
});