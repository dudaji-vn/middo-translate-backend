import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { socketConfig } from 'src/configs/socket.config';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({ namespace: 'call', cors: '*' })
export class CallGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private activeSockets: { roomId: string; id: string; peerId: string }[] = [];

  private logger: Logger = new Logger('MessageGateway');

  // @SubscribeMessage('client.join')
  // public joinRoom(
  //   client: Socket,
  //   { peerId, roomId }: { peerId: string; roomId: string },
  // ): void {
  //   client.join(roomId);
  //   console.log('join room', roomId);
  //   this.activeSockets.push({ roomId, id: client.id, peerId });
  //   this.server.to(roomId).emit('call.join', this.activeSockets);
  // }
  @SubscribeMessage(socketConfig.events.call.join)
  handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() { peerId, roomId }: { peerId: string; roomId: string },
  ) {
    client.join(roomId);
    console.log('join room', roomId);
    this.activeSockets.push({ roomId, id: client.id, peerId });
    this.server.to(roomId).emit('call.join', this.activeSockets);
  }

  public handleDisconnect(client: Socket): void {
    this.activeSockets = this.activeSockets.filter(
      (socket) => socket.id !== client.id,
    );
    this.server.emit(socketConfig.events.call.leave, this.activeSockets);
  }

  public afterInit(server: Server): void {
    this.logger.log('Init');
  }
}
