// ============================================
// SERVER.JS - Game server with lobbies!
// Handles rooms, player connections, and
// syncing everyone's position in real time
// ============================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve our game files
app.use(express.static('.'));

// --- ROOMS ---
// Each room holds up to 5 players
// rooms = { 'ABC123': { maxPlayers: 3, players: { socketId: { name, color } } } }
const rooms = {};

// Generate a random 6-character room code like "ABC123"
function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Player colors - each player gets a different color!
const PLAYER_COLORS = ['#44aaff', '#ff4444', '#44ff44', '#ffaa00', '#ff44ff'];

// ============================================
// SOCKET.IO - handles real-time communication
// ============================================

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  let currentRoom = null;

  // --- CREATE ROOM ---
  socket.on('createRoom', (data) => {
    const code = makeRoomCode();
    const maxPlayers = Math.max(1, Math.min(5, data.maxPlayers || 1));

    rooms[code] = {
      maxPlayers: maxPlayers,
      players: {},
      started: false
    };

    // Add this player to the room
    rooms[code].players[socket.id] = {
      name: data.name || 'Player',
      color: PLAYER_COLORS[0],
      ready: false
    };

    currentRoom = code;
    socket.join(code);

    // Tell the player their room was created
    socket.emit('roomCreated', {
      code: code,
      maxPlayers: maxPlayers,
      players: rooms[code].players
    });

    console.log(`Room ${code} created (max ${maxPlayers} players)`);

    // If solo (1 player), they can start right away
    if (maxPlayers === 1) {
      rooms[code].started = true;
      io.to(code).emit('gameStart', { players: rooms[code].players });
    }
  });

  // --- JOIN ROOM ---
  socket.on('joinRoom', (data) => {
    const code = data.code.toUpperCase().trim();
    const room = rooms[code];

    if (!room) {
      socket.emit('joinError', 'Room not found! Check the code.');
      return;
    }

    if (room.started) {
      socket.emit('joinError', 'Game already started!');
      return;
    }

    const playerCount = Object.keys(room.players).length;
    if (playerCount >= room.maxPlayers) {
      socket.emit('joinError', 'Room is full!');
      return;
    }

    // Add player to room
    room.players[socket.id] = {
      name: data.name || 'Player',
      color: PLAYER_COLORS[playerCount],
      ready: false
    };

    currentRoom = code;
    socket.join(code);

    // Tell everyone in the room about the update
    io.to(code).emit('roomUpdate', {
      code: code,
      maxPlayers: room.maxPlayers,
      players: room.players
    });

    console.log(`Player joined room ${code} (${playerCount + 1}/${room.maxPlayers})`);
  });

  // --- PLAYER READY ---
  socket.on('playerReady', () => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];

    if (room.players[socket.id]) {
      room.players[socket.id].ready = true;
    }

    // Tell everyone about the update
    io.to(currentRoom).emit('roomUpdate', {
      code: currentRoom,
      maxPlayers: room.maxPlayers,
      players: room.players
    });

    // Check if all players are ready AND room is full
    const playerList = Object.values(room.players);
    const allReady = playerList.every(p => p.ready);
    const roomFull = playerList.length >= room.maxPlayers;

    if (allReady && roomFull && !room.started) {
      room.started = true;
      io.to(currentRoom).emit('gameStart', { players: room.players });
      console.log(`Game starting in room ${currentRoom}!`);
    }
  });

  // --- PLAYER POSITION UPDATE ---
  // Each player sends their position ~20 times per second
  socket.on('playerUpdate', (data) => {
    if (!currentRoom) return;
    // Send to everyone ELSE in the room (not back to sender)
    socket.to(currentRoom).emit('playerMoved', {
      id: socket.id,
      x: data.x,
      y: data.y,
      z: data.z,
      rotationY: data.rotationY,
      isSwinging: data.isSwinging
    });
  });

  // --- ENEMY DAMAGE (host syncs enemies) ---
  socket.on('enemyDamaged', (data) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('enemyDamaged', data);
  });

  // --- DISCONNECT ---
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);

    if (currentRoom && rooms[currentRoom]) {
      delete rooms[currentRoom].players[socket.id];

      // If room is empty, delete it
      if (Object.keys(rooms[currentRoom].players).length === 0) {
        delete rooms[currentRoom];
        console.log(`Room ${currentRoom} deleted (empty)`);
      } else {
        // Tell remaining players
        io.to(currentRoom).emit('playerLeft', { id: socket.id });
        io.to(currentRoom).emit('roomUpdate', {
          code: currentRoom,
          maxPlayers: rooms[currentRoom].maxPlayers,
          players: rooms[currentRoom].players
        });
      }
    }
  });
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('🌲 99 Nights in the Forest is running!');
  console.log('🎮 Open http://localhost:' + PORT + ' in your browser to play!');
});
