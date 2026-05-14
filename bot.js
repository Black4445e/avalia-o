const { WebcastPushConnection } = require('tiktok-live-connector');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');

// =========================
// CONFIG
// =========================

const USERNAME = '@moranguinhagamerofc';
const PORT = 3000;
const DATABASE = 'fila.json';

// =========================
// EXPRESS
// =========================

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// =========================
// DATABASE
// =========================

if (!fs.existsSync(DATABASE)) {
    fs.writeFileSync(DATABASE, JSON.stringify([], null, 2));
}

function salvarJSON() {

    fs.writeFileSync(
        DATABASE,
        JSON.stringify(fila, null, 2)
    );

    io.emit('fila', fila);
}

// =========================
// FILA
// =========================

const usuarios = new Map();

let fila = [];

// =========================
// API
// =========================

app.get('/api/fila', (req, res) => {

    fila.sort((a, b) => b.pontos - a.pontos);

    res.json(fila);
});

// REMOVER

app.delete('/api/remover/:id', (req, res) => {

    const id = req.params.id;

    fila = fila.filter(u => u.uniqueId !== id);

    usuarios.delete(id);

    salvarJSON();

    res.json({
        ok: true
    });
});

// =========================
// SERVER
// =========================

server.listen(PORT, () => {

    console.log(`API ONLINE`);
    console.log(`http://localhost:${PORT}`);
});

// =========================
// TIKTOK
// =========================

let tiktokLiveConnection = null;

async function conectar() {

    console.log('\nTentando conectar...');

    tiktokLiveConnection =
        new WebcastPushConnection(USERNAME);

    try {

        const state =
            await tiktokLiveConnection.connect();

        console.clear();

        console.log(`LIVE ONLINE`);
        console.log(`Sala ${state.roomId}\n`);

        // RESET NOVA LIVE

        usuarios.clear();
        fila = [];

        salvarJSON();

        iniciarEventos();

    } catch (err) {

        console.log('Live offline...');
        console.log('Aguardando próxima live...\n');

        setTimeout(conectar, 30000);
    }
}

// =========================
// EVENTOS
// =========================

function iniciarEventos() {

    // CHAT

    tiktokLiveConnection.on('chat', data => {

        const comentario =
            data.comment.trim();

        const nickname =
            data.nickname;

        const uniqueId =
            data.uniqueId;

        // Junta números

        const comentarioLimpo =
            comentario
            .replace(/\s+/g, '')
            .replace(/-/g, '');

        // Procura número

        const match =
            comentarioLimpo.match(/\d{6,}/);

        if (!match) return;

        // Duplicado

        if (usuarios.has(uniqueId)) return;

        const numero = match[0];

        const userData = {

            uniqueId,
            nickname,
            numero,
            pontos: 0
        };

        usuarios.set(uniqueId, userData);

        fila.push(userData);

        salvarJSON();

        console.log(
            `Novo: ${nickname} -> ${numero}`
        );
    });

    // GIFT

    tiktokLiveConnection.on('gift', data => {

        const uniqueId =
            data.uniqueId;

        if (!usuarios.has(uniqueId))
            return;

        const userData =
            usuarios.get(uniqueId);

        const moedas =
            data.diamondCount || 1;

        userData.pontos += moedas;

        fila.sort((a, b) =>
            b.pontos - a.pontos
        );

        salvarJSON();

        console.log(
            `${userData.nickname} enviou ${moedas} moedas`
        );
    });

    // LIVE OFF

    tiktokLiveConnection.on('streamEnd', () => {

        console.log('\nLIVE ENCERRADA');
        console.log('Aguardando próxima live...\n');

        setTimeout(conectar, 30000);
    });
}

// =========================
// START
// =========================

conectar();