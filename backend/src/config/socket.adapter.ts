import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplicationContext } from '@nestjs/common';
import { Server, type ServerOptions } from 'socket.io';
export class SocketAdapter extends IoAdapter {
  constructor(app: INestApplicationContext, private readonly origin: string) { super(app); }
  createIOServer(port: number, options?: ServerOptions): Server {
    const target = this.httpServer && port === 0 ? this.httpServer : port;
    return new Server(target, {
      ...options,
      cors: {
        origin: this.origin,
        credentials: true,
      },
      allowRequest: (request, callback) => {
        const requestOrigin = request.headers.origin;
        callback(null, requestOrigin === undefined || requestOrigin === this.origin);
      },
    });
  }
}
