import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { supabase } from './supabase.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bienvenido al chat de meet2go!');
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const clients = new Map();

io.on('connection', (socket) => {
  console.log(`📡 Nueva conexión: ${socket.id}`);

  // ==========================
  // REGISTER
  // ==========================
  socket.on('register', (uid) => {
    const userId = typeof uid === 'object' && uid._j ? uid._j : uid;
    clients.set(userId, socket.id);

    console.log(`🟢 Usuario registrado: ${userId} → socket ${socket.id}`);
    console.log('Clientes conectados:', clients);
  });

  // ==========================
  // MESSAGE
  // ==========================
  socket.on('message', async ({ fromUid, toUid, text }) => {
    console.log('\n💬 MENSAJE RECIBIDO DEL CLIENTE:');
    console.log({ fromUid, toUid, text });

    const sender = typeof fromUid === 'object' && fromUid._j ? fromUid._j : fromUid;

    // 👉 Guardar en Supabase
    const { data, error } = await supabase
      .from('messages')
      .insert([{ fromUid: sender, toUid, message: text }])
      .select()
      .single();

    if (error) {
      console.error('❌ Error guardando en Supabase:', error);
      return;
    }

    console.log('🗄️ Mensaje guardado en Supabase:');
    console.log(data);

    // 👉 Reenviar a destinatario
    const targetSocketId = clients.get(toUid);
    if (targetSocketId) {
      console.log(`📨 Enviando mensaje a socket: ${targetSocketId}`);
      io.to(targetSocketId).emit('message', data);
    } else {
      console.log(`⚠️ Usuario ${toUid} no está conectado. No se envió en tiempo real.`);
    }
  });

  // ==========================
  // DISCONNECT
  // ==========================
  socket.on('disconnect', () => {
    for (const [uid, id] of clients.entries()) {
      if (id === socket.id) {
        clients.delete(uid);
        console.log(`🔴 Usuario desconectado: ${uid}`);
        break;
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});
