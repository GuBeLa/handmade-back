import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-order')
  handleJoinOrder(client: Socket, orderId: string) {
    client.join(`order-${orderId}`);
  }

  @SubscribeMessage('leave-order')
  handleLeaveOrder(client: Socket, orderId: string) {
    client.leave(`order-${orderId}`);
  }

  @SubscribeMessage('send-message')
  handleMessage(client: Socket, payload: any) {
    this.server.to(`order-${payload.orderId}`).emit('new-message', payload);
  }
}

