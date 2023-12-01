import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { socketConfig } from 'src/configs/socket.config';
import { NewMessagePayload } from './types/message-payload.type';
import { UpdateRoomPayload } from './types/room-payload.type';

@WebSocketGateway({ cors: '*' })
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  // constructor()
  // private readonly eventEmitter: EventEmitter2, // private readonly roomsService: RoomsService, // private readonly usersService: UsersService,
  // @InjectModel(Message) private readonly messageModel: Model<Message>,
  // {}
  @WebSocketServer()
  public server: Server;
  private clients: {
    [key: string]: {
      socketIds: string[];
    };
  } = {};
  afterInit(server: Server) {
    console.log('socket ', server?.engine?.clientsCount);
    // console.log('socket ', server?.engine?.clientsCount);
  }

  handleConnection(@ConnectedSocket() client: Socket) {
    // console.log('socket ', client?.id);
  }
  handleDisconnect(@ConnectedSocket() client: Socket) {
    // console.log('socket ', client?.id);
  }

  @SubscribeMessage('client.join')
  joinAdminRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() userId: number,
  ) {
    console.log('client.join', userId);
    client.join(userId.toString());
    this.clients[userId.toString()] = {
      socketIds: [
        ...(this.clients[userId.toString()]?.socketIds || []),
        client.id,
      ],
    };
  }

  @SubscribeMessage(socketConfig.events.chat.join)
  handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    console.log('handleJoinChat', roomId);
    client.join(roomId);
  }
  @SubscribeMessage(socketConfig.events.chat.leave)
  handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    console.log('handleLeaveChat', roomId);
    client.leave(roomId);
  }

  @OnEvent(socketConfig.events.message.new)
  async handleNewMessage({ roomId, message, clientTempId }: NewMessagePayload) {
    console.log('handleNewMessage 🙂', roomId, message, clientTempId);
    this.server.to(roomId).emit(socketConfig.events.message.new, {
      message,
      clientTempId,
    });
  }
  @OnEvent(socketConfig.events.room.update)
  async handleUpdateRoom({ data, participants, roomId }: UpdateRoomPayload) {
    // console.log('handleUpdateRoom', roomId, data, participants);
    const socketIds = participants
      .map((p) => this.clients[p.toString()]?.socketIds || [])
      .flat();
    this.server.to(socketIds).emit(socketConfig.events.room.update, {
      roomId,
      data,
    });
  }
  @OnEvent(socketConfig.events.message.update)
  async handleUpdateMessage({ roomId, message }: NewMessagePayload) {
    this.server.to(roomId).emit(socketConfig.events.message.update, message);
  }
  @OnEvent(socketConfig.events.message.remove)
  async handleRemoveMessage({ message }: NewMessagePayload) {
    const socketIds = message.removedFor
      .map((id) => this.clients[id.toString()]?.socketIds || [])
      .flat();
    this.server.to(socketIds).emit(socketConfig.events.message.update, message);
  }
  @OnEvent(socketConfig.events.room.delete)
  async handleDeleteRoom({ roomId, participants }: UpdateRoomPayload) {
    const socketIds = participants
      .map((p) => this.clients[p.toString()]?.socketIds || [])
      .flat();
    this.server.to(socketIds).emit(socketConfig.events.room.delete, roomId);
  }
  @OnEvent(socketConfig.events.room.leave)
  async handleLeaveRoom({
    roomId,
    userId,
  }: {
    roomId: string;
    userId: number;
  }) {
    const socketIds = this.clients[userId.toString()]?.socketIds || [];
    this.server.to(socketIds).emit(socketConfig.events.room.leave, roomId);
  }
}
