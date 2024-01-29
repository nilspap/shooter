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
const frameDuration = 16;
const playerSize = 10;
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
        x: 0,
        y: 0,
        aimDirection: "right"
    };
    playerCounter += 1;
    gameState.players.push(currentPlayer);
    distributeState();

    ws.on('error', console.error);
    function movePlayer(moveDirection) {
        if (moveDirection == "down") {
            currentPlayer.y += playerSpeed;

        }
        if (moveDirection == "up") {
            currentPlayer.y -= playerSpeed;

        }
        if (moveDirection == "left") {
            currentPlayer.x -= playerSpeed;

        }
        if (moveDirection == "right") {
            currentPlayer.x += playerSpeed;

        }
        currentPlayer.aimDirection = moveDirection;
        distributeState();
    }
    function moveBullet(message) {
        let flightEnded = false;
        if (message.flightDirection == "up") {
            message.y -= message.bulletSpeed;
            if (message.y <= message.bulletTargetY) {
                flightEnded = true;
            }
        } else if (message.flightDirection == "down") {
            message.y += message.bulletSpeed;
            if (message.y >= message.bulletTargetY) {
                flightEnded = true;
            }
        } else if (message.flightDirection == "left") {
            message.x -= message.bulletSpeed;
            if (message.x <= message.bulletTargetX) {
                flightEnded = true;
            }
        } else if (message.flightDirection == "right") {
            message.x += message.bulletSpeed;
            if (message.x >= message.bulletTargetX) {
                flightEnded = true;
            }
        }
        hitCalculation(message);
        if (flightEnded == false) {
            setTimeout(() => moveBullet(message), message.frameDuration);
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
                distributeMessage({
                    type: "hit",
                    victim: player.id
                });
                player.x = 0;
                player.y = 0;
            }
        }
    }
    function shoot() {
        let bulletTargetX = currentPlayer.x;
        let bulletTargetY = currentPlayer.y;
        if (currentPlayer.aimDirection == "up") {
            bulletTargetY -= flightDistance;
        } else if (currentPlayer.aimDirection == "down") {
            bulletTargetY += flightDistance;
        } else if (currentPlayer.aimDirection == "left") {
            bulletTargetX -= flightDistance;
        } else if (currentPlayer.aimDirection == "right") {
            bulletTargetX += flightDistance;
        }
        const message = {
            type: "bullet",
            x: currentPlayer.x,
            y: currentPlayer.y,
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
        console.log('received: %s', data);
        const command = JSON.parse(data);
        if (command.action == "move") {
            movePlayer(command.moveDirection);
        }
        if (command.action == "shoot") {
            shoot();
        }
        console.log(JSON.stringify(gameState));


    });
});