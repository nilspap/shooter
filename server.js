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
    const player = {
        id: playerId,
        x: 0,
        y: 0,
        aimDirection: "right"
    };
    playerCounter += 1;
    gameState.players.push(player);
    distributeState();

    ws.on('error', console.error);
    function movePlayer(moveDirection) {
        if (moveDirection == "down") {
            player.y += playerSpeed;

        }
        if (moveDirection == "up") {
            player.y -= playerSpeed;

        }
        if (moveDirection == "left") {
            player.x -= playerSpeed;

        }
        if (moveDirection == "right") {
            player.x += playerSpeed;

        }
        player.aimDirection = moveDirection;
        distributeState();
    }
    function shoot() {
        let bulletTargetX = player.x;
        let bulletTargetY = player.y;
        if (player.aimDirection == "up") {
            bulletTargetY -= flightDistance;
        } else if (player.aimDirection == "down") {
            bulletTargetY += flightDistance;
        } else if (player.aimDirection == "left") {
            bulletTargetX -= flightDistance;
        } else if (player.aimDirection == "right") {
            bulletTargetX += flightDistance;
        }
        distributeMessage({
            type: "bullet",
            x: player.x,
            y: player.y,
            flightDirection: player.aimDirection,
            bulletSpeed: bulletSpeed,
            shooterId: playerId,
            bulletTargetX: bulletTargetX,
            bulletTargetY: bulletTargetY
        });
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