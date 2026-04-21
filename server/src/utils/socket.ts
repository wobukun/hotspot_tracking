import { Server as SocketIOServer } from 'socket.io';

// 全局 io 实例，避免循环依赖
let io: SocketIOServer | null = null;

export const setIO = (socketServer: SocketIOServer) => {
  io = socketServer;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io 尚未初始化！请先调用 setIO()');
  }
  return io;
};
