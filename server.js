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

    ws.on('message', function message(data) {
        console.log('received: %s', data);
        const command = JSON.parse(data);
        if (command.action == "down") {
            player.y += playerSpeed;
            player.aimDirection = command.action;
        }
        if (command.action == "up") {
            player.y -= playerSpeed;
            player.aimDirection = command.action;
        }
        if (command.action == "left") {
            player.x -= playerSpeed;
            player.aimDirection = command.action;
        }
        if (command.action == "right") {
            player.x += playerSpeed;
            player.aimDirection = command.action;
        }
        if (command.action == "shoot") {
            distributeMessage({
                type: "bullet",
                x: player.x,
                y: player.y,
                flightDirection: player.aimDirection,
                shooterId: playerId,
                flightDistance: 100
            })
        }
        console.log(JSON.stringify(gameState))
        distributeState();

    });
});