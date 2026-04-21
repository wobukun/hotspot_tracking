import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('hotspot', (data: any) => {
      this.emit('hotspot', data);
    });

    this.socket.on('notification', (data: any) => {
      this.emit('notification', data);
    });

    this.socket.on('hotspot-complete', (data: any) => {
      this.emit('hotspot-complete', data);
    });

    this.socket.on('hotspot-error', (data: any) => {
      this.emit('hotspot-error', data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribe(keyword: string) {
    this.socket?.emit('subscribe', keyword);
  }

  unsubscribe(keyword: string) {
    this.socket?.emit('unsubscribe', keyword);
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}

export const socketService = new SocketService();
