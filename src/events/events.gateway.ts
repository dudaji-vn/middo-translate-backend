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
import {
  NewMessagePayload,
  ReplyMessagePayload,
} from './types/message-payload.type';
import { UpdateRoomPayload } from './types/room-payload.type';
import { CallService } from 'src/call/call.service';
import Meeting from './interface/meeting.interface';
import { Room } from 'src/rooms/schemas/room.schema';

@WebSocketGateway({
  cors: '*',
  maxHttpBufferSize: 100000000,
})
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
  constructor(private callService: CallService) {}
  afterInit(server: Server) {
    // console.log('socket ', server?.engine?.clientsCount);
    // console.log('socket ', server?.engine?.clientsCount);
  }

  handleConnection(@ConnectedSocket() client: Socket) {
    // console.log('socket ', client?.id);
  }
  // handleDisconnect(@ConnectedSocket() client: Socket) {
  //   // console.log('socket ', client?.id);
  // }

  @SubscribeMessage('client.join')
  joinAdminRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() userId: number,
  ) {
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
    client.leave(roomId);
  }

  // Room events
  @OnEvent(socketConfig.events.room.update)
  async handleUpdateRoom({ data, participants, roomId }: UpdateRoomPayload) {
    const socketIds = participants
      .map((p) => this.clients[p.toString()]?.socketIds || [])
      .flat();
    this.server.to(socketIds).emit(socketConfig.events.room.update, {
      roomId,
      data,
    });
  }
  @OnEvent(socketConfig.events.room.new)
  async handleNewRoom(room: Room) {
    const socketIds = room.participants
      .map((p) => this.clients[p._id.toString()]?.socketIds || [])
      .flat();
    this.server.to(socketIds).emit(socketConfig.events.room.new, room);
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
  // Message events
  @OnEvent(socketConfig.events.message.new)
  async handleNewMessage({ roomId, message, clientTempId }: NewMessagePayload) {
    this.server.to(roomId).emit(socketConfig.events.message.new, {
      message,
      clientTempId,
    });
  }
  @OnEvent(socketConfig.events.message.update)
  async handleUpdateMessage({ roomId, message }: NewMessagePayload) {
    console.log('handleUpdateMessage', message);
    if (message.parent) {
      console.log('handleUpdateMessage', message.parent._id.toString());
      this.server
        .to(message.parent._id.toString())
        .emit(socketConfig.events.message.reply.update, message);
      return;
    }
    this.server.to(roomId).emit(socketConfig.events.message.update, message);
  }
  @OnEvent(socketConfig.events.message.remove)
  async handleRemoveMessage({ message }: NewMessagePayload) {
    if (message.parent) {
      this.server
        .to(message.parent._id.toString())
        .emit(socketConfig.events.message.reply.update, message);
      return;
    }
    const socketIds = message.removedFor
      .map((id) => this.clients[id.toString()]?.socketIds || [])
      .flat();
    this.server.to(socketIds).emit(socketConfig.events.message.update, message);
  }

  // Reply message events

  @OnEvent(socketConfig.events.message.reply.new)
  async handleReplyMessage({ replyToMessageId, message }: ReplyMessagePayload) {
    this.server
      .to(replyToMessageId)
      .emit(socketConfig.events.message.reply.new, message);
  }

  @SubscribeMessage(socketConfig.events.message.reply.join)
  handleJoinDiscussion(
    @ConnectedSocket() client: Socket,
    @MessageBody() messageId: string,
  ) {
    console.log('handleJoinDiscussion', messageId);
    client.join(messageId);
  }
  @SubscribeMessage(socketConfig.events.message.reply.leave)
  handleLeaveDiscussion(
    @ConnectedSocket() client: Socket,
    @MessageBody() messageId: string,
  ) {
    console.log('handleLeaveDiscussion', messageId);
    client.leave(messageId);
  }

  // Events for call
  private meetings: Record<string, Meeting> = {};
  private socketToRoom: Record<string, any> = {};

  // Handle join call event
  @SubscribeMessage(socketConfig.events.call.join)
  handleJoinCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() { roomId, user }: { roomId: string; user: any },
  ) {
    if (this.meetings[roomId]) {
      this.meetings[roomId].participants.push({ id: client.id, user });
    } else {
      this.meetings[roomId] = { participants: [{ id: client.id, user }] };
    }
    this.socketToRoom[client.id] = roomId;
    const userInThisRoom = this.meetings[roomId].participants.filter(
      (user: any) => user.id !== client.id,
    );
    client.join(roomId);
    this.server.to(client.id).emit(socketConfig.events.call.list_participant, {
      users: userInThisRoom,
      doodleImage: this.meetings[roomId]?.doodle?.image,
    });
  }

  // Send notify invite_to_call event
  @SubscribeMessage(socketConfig.events.call.invite_to_call)
  sendNotifyJoinCall(
    @MessageBody()
    payload: {
      users: string[];
      call: string;
      user: any;
    },
  ) {
    const socketIds = payload.users
      .map((p) => this.clients[p.toString()]?.socketIds || [])
      .flat();
    this.server.to(socketIds).emit(socketConfig.events.call.invite_to_call, {
      call: payload.call,
      user: payload.user,
    });
  }
  // Send signal event
  @SubscribeMessage(socketConfig.events.call.send_signal)
  sendSignal(
    @MessageBody()
    payload: {
      id: string;
      user: any;
      callerId: string;
      signal: any;
      isShareScreen: boolean;
    },
  ) {
    this.server.to(payload.id).emit(socketConfig.events.call.user_joined, {
      signal: payload.signal,
      callerId: payload.callerId,
      user: payload.user,
      isShareScreen: payload.isShareScreen,
    });
  }

  // Return signal event
  @SubscribeMessage(socketConfig.events.call.return_signal)
  returnSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      signal: any;
      callerId: string;
      user: any;
      isShareScreen: boolean;
    },
  ) {
    this.server
      .to(payload.callerId)
      .emit(socketConfig.events.call.receive_return_signal, {
        signal: payload.signal,
        id: client.id,
        user: payload.user,
        isShareScreen: payload.isShareScreen,
      });
  }

  // SHARE_SCREEN
  @SubscribeMessage(socketConfig.events.call.share_screen)
  handleShareScreen(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    const userInRoom = this.meetings[roomId].participants.filter(
      (user: any) => user.id !== client.id,
    );
    this.server
      .to(client.id)
      .emit(
        socketConfig.events.call.list_participant_need_add_screen,
        userInRoom,
      );
  }
  // Request get share screen
  @SubscribeMessage(socketConfig.events.call.request_get_share_screen)
  handleRequestGetShareScreen(@ConnectedSocket() client: Socket) {
    const roomId = this.socketToRoom[client.id];
    this.server
      .to(roomId)
      .emit(socketConfig.events.call.request_get_share_screen, client.id);
  }
  // Stop share screen
  @SubscribeMessage(socketConfig.events.call.stop_share_screen)
  handleStopShareScreen(@ConnectedSocket() client: Socket) {
    const roomId = this.socketToRoom[client.id];
    this.server
      .to(roomId)
      .emit(socketConfig.events.call.stop_share_screen, client.id);
  }
  // Request Join Room
  @SubscribeMessage(socketConfig.events.call.request_join_room)
  handleRequestJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { roomId: string; user: any },
  ) {
    const roomId = payload.roomId;
    const user = payload.user;
    this.server.to(roomId).emit(socketConfig.events.call.request_join_room, {
      user,
      socketId: client.id,
    });
  }
  // Accept Join Room
  @SubscribeMessage(socketConfig.events.call.accept_join_room)
  handleAcceptJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { socketId: string; roomInfo: any },
  ) {
    const roomId = this.socketToRoom[client.id];
    const socketId = payload.socketId;
    this.server.to(socketId).emit(socketConfig.events.call.accept_join_room, {
      roomInfo: payload.roomInfo,
    });
    this.server
      .to(roomId)
      .emit(socketConfig.events.call.answered_join_room, socketId);
  }
  // Reject Join Room
  @SubscribeMessage(socketConfig.events.call.reject_join_room)
  handleRejectJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { socketId: string },
  ) {
    const roomId = this.socketToRoom[client.id];
    const socketId = payload.socketId;
    this.server.to(socketId).emit(socketConfig.events.call.reject_join_room);
    this.server
      .to(roomId)
      .emit(socketConfig.events.call.answered_join_room, socketId);
  }
  // Start doodle
  @SubscribeMessage(socketConfig.events.call.start_doodle)
  handleStartDoodle(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { image_url: string; name: string },
  ) {
    const roomId = this.socketToRoom[client.id];
    this.meetings[roomId].doodle = {
      image: payload.image_url,
      data: [],
      socketId: client.id,
    };
    this.server.to(roomId).emit(socketConfig.events.call.start_doodle, {
      image_url: payload.image_url,
      name: payload.name,
    });
  }
  // End doodle
  @SubscribeMessage(socketConfig.events.call.end_doodle)
  handleEndDoodle(
    @ConnectedSocket() client: Socket,
    @MessageBody() name: string,
  ) {
    const roomId = this.socketToRoom[client.id];
    delete this.meetings[roomId].doodle;
    this.server.to(roomId).emit(socketConfig.events.call.end_doodle, name);
  }
  // Draw doodle
  @SubscribeMessage(socketConfig.events.call.draw_doodle)
  handleDrawDoodle(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { path: any; isEraser: boolean; width: number; height: string },
  ) {
    const roomId = this.socketToRoom[client.id];
    this.meetings[roomId].doodle?.data.push({
      path: payload.path,
      isEraser: payload.isEraser,
      width: payload.width,
      height: payload.height,
      userId: client.id,
    });
    this.server.to(roomId).emit(socketConfig.events.call.draw_doodle, {
      path: payload.path,
      isEraser: payload.isEraser,
      width: payload.width,
      height: payload.height,
      userId: client.id,
    });
  }
  // Request get old doodle data
  @SubscribeMessage(socketConfig.events.call.request_get_old_doodle_data)
  handleRequestGetOldDoodleData(@ConnectedSocket() client: Socket) {
    const roomId = this.socketToRoom[client.id];
    const doodleData = this.meetings[roomId].doodle?.data || [];
    this.server
      .to(client.id)
      .emit(socketConfig.events.call.request_get_old_doodle_data, doodleData);
  }
  // Send caption
  @SubscribeMessage(socketConfig.events.call.send_caption)
  handleSendCaption(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const roomId = this.socketToRoom[client.id];
    this.server.to(roomId).emit(socketConfig.events.call.send_caption, payload);
  }
  private leaveCall(client: Socket) {
    const roomId = this.socketToRoom[client.id];
    const meeting = this.meetings[roomId];
    if (!meeting) return;
    // Stop doodle if this user start doodle
    if (meeting?.doodle?.socketId === client.id) {
      delete this.meetings[roomId].doodle;
      const nameOfUser = meeting.participants.find(
        (user: any) => user.id === client.id,
      )?.user?.name;
      this.server
        .to(roomId)
        .emit(socketConfig.events.call.end_doodle, nameOfUser);
    }

    meeting.participants = meeting.participants.filter(
      (user: any) => user.id !== client.id,
    );
    this.meetings[roomId] = meeting;
    // Leave room
    client.leave(roomId);
    this.server.emit(socketConfig.events.call.leave, client.id);

    // Check if room is empty then delete room
    delete this.socketToRoom[client.id];
    if (meeting?.participants.length === 0) {
      const room = this.meetings[roomId]?.room;
      const participants = room?.participants?.filter((p: any) =>
        p._id.toString(),
      );
      const socketIds = participants
        ?.map((p: any) => this.clients[p.toString()]?.socketIds || [])
        .flat();
      this.server
        .to(socketIds)
        .emit(socketConfig.events.call.meeting_end, room?._id);
      delete this.meetings[roomId];
      this.callService.endCall(roomId);
    }
  }

  @OnEvent(socketConfig.events.call.update) // Update call event
  handleUpdateCall(@MessageBody() call: any) {
    console.log('handleUpdateCall', call);
    this.server.emit(socketConfig.events.call.update, call);
  }
  // Leave call event
  @SubscribeMessage(socketConfig.events.call.leave)
  handleLeaveCall(@ConnectedSocket() client: Socket) {
    this.leaveCall(client);
  }

  // User disconnect
  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.leaveCall(client);
  }
  // End events for call
}
