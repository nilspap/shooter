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
    players: [{
        id: "player1",
        x: 0,
        y: 0
    }]
}
function distributeState() {
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(gameState));
        }
    });
}
wss.on('connection', function connection(ws) {
    distributeState();
    ws.on('error', console.error);

    ws.on('message', function message(data) {
        console.log('received: %s', data);
        const command = JSON.parse(data);
        const player = gameState.players.find(player => player.id == command.player);
        if (command.action == "down") {
            player.y += 1;
        }
        if (command.action == "up") {
            player.y -= 1;
        }
        if (command.action == "left") {
            player.x -= 1;
        }
        if (command.action == "right") {
            player.x += 1;
        }
        console.log(JSON.stringify(gameState))
        distributeState();

    });
});