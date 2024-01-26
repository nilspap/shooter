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
    players: []
}
const playerSpeed = 5;
let playerCounter = 1;
function distributeState() {
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(gameState));
        }
    });
}
wss.on('connection', function connection(ws) {
    const player = {
        id: `player${playerCounter}`,
        x: 0,
        y: 0
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
        }
        if (command.action == "up") {
            player.y -= playerSpeed;
        }
        if (command.action == "left") {
            player.x -= playerSpeed;
            ;
        }
        if (command.action == "right") {
            player.x += playerSpeed;
        }
        console.log(JSON.stringify(gameState))
        distributeState();

    });
});