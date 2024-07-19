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
import {
  DeleteContactPayload,
  UpdateRoomPayload,
} from './types/room-payload.type';
import { CallService } from 'src/call/call.service';
import Meeting, { ParticipantMeeting, RoomType } from './interface/meeting.interface';
import { Room } from 'src/rooms/schemas/room.schema';
import { RoomsService } from 'src/rooms/rooms.service';
import { WatchingService } from 'src/watching/watching.service';
import speech from '@google-cloud/speech';
// import { Logger } from '@nestjs/common';
import { logger } from 'src/common/utils/logger';
import { User, UserStatus } from 'src/users/schemas/user.schema';
import { Space } from 'src/help-desk/schemas/space.schema';
process.env.GOOGLE_APPLICATION_CREDENTIALS = './speech-to-text-key.json';
const speechClient = new speech.SpeechClient();
@WebSocketGateway({
  cors: '*',
  maxHttpBufferSize: 100000000,
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  public server: Server;
  private clients: {
    [key: string]: {
      socketIds: string[];
    };
  } = {};
  private meetings: Record<string, Meeting> = {};
  private socketToRoom: Record<string, any> = {};
  constructor(
    private callService: CallService,
    private roomService: RoomsService,
    private watchingService: WatchingService,
  ) {}
  afterInit(server: Server) {
    // console.log('socket ', server?.engine?.clientsCount);
    // console.log('socket ', server?.engine?.clientsCount);
  }

  handleConnection(@ConnectedSocket() client: Socket) {
    logger.info('socket', client?.id);
    const userId = findUserIdBySocketId(this.clients, client.id);
    logger.info('userId', userId);
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.leaveCall(client);
    const socketId = client.id;
    this.watchingService.deleteBySocketId(socketId);
    this.stopRecognitionStream(client);
    // remove socketId from clients
    for (const userId in this.clients) {
      this.clients[userId].socketIds = this.clients[userId].socketIds.filter(
        (id) => id !== socketId,
      );
      if (this.clients[userId].socketIds.length === 0) {
        delete this.clients[userId];
      }
    }
    const userIds = Object.keys(this.clients);
    logger.info('socket disconnected', userIds);
    this.server.emit(socketConfig.events.client.list, userIds);
  }

  @SubscribeMessage(socketConfig.events.client.join)
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
    const userIds = Object.keys(this.clients);
    logger.info('socket connected', userIds);
    this.server.emit(socketConfig.events.client.list, userIds);
    
    this.pushMeetingList({
      type: 'user',
      id: userId.toString()
    })
  }

  @SubscribeMessage(socketConfig.events.chat.join)
  handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    {
      roomId,
      notifyToken,
    }: {
      roomId: string;
      notifyToken?: string;
    },
  ) {
    const userId = findUserIdBySocketId(this.clients, client.id);
    logger.info('Chat join', roomId, notifyToken, userId);

    if (userId && notifyToken) {
      this.watchingService.create({
        userId: userId,
        roomId: roomId,
        notifyToken: notifyToken,
        socketId: client.id,
      });
    }
    client.join(roomId);
  }
  @SubscribeMessage(socketConfig.events.chat.leave)
  handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    {
      roomId,
      notifyToken,
    }: {
      roomId: string;
      notifyToken: string;
    },
  ) {
    this.watchingService.deleteBySocketId(client.id);
    client.leave(roomId);
  }

  // Room events

  @OnEvent(socketConfig.events.room.new)
  async handleNewRoom(room: Room) {
    const socketIds = room.participants
      .map((p) => this.clients[p._id.toString()]?.socketIds || [])
      .flat();
    this.server.to(socketIds).emit(socketConfig.events.inbox.new, room);
  }

  @OnEvent(socketConfig.events.room.update)
  async handleUpdateRoom({ data, participants, roomId }: UpdateRoomPayload) {
    // update inbox
    const socketIds = participants
      .map((p) => this.clients[p.toString()]?.socketIds || [])
      .flat();
    this.server.to(socketIds).emit(socketConfig.events.inbox.update, {
      roomId,
      data,
    });

    // Update room
    this.server.to(roomId).emit(socketConfig.events.room.update, data);
  }
  @OnEvent(socketConfig.events.room.delete_contact)
  async handleDeleteContact({ participants, data }: DeleteContactPayload) {
    const socketIds = participants
      .map((p) => this.clients[p.toString()]?.socketIds || [])
      .flat();
    this.server
      .to(socketIds)
      .emit(socketConfig.events.room.delete_contact, data);
  }

  @OnEvent(socketConfig.events.room.delete)
  async handleDeleteRoom({ roomId, participants }: UpdateRoomPayload) {
    const socketIds = participants
      .map((p) => this.clients[p.toString()]?.socketIds || [])
      .flat();
    this.server.to(socketIds).emit(socketConfig.events.room.delete, roomId);
    this.server.to(socketIds).emit(socketConfig.events.inbox.delete, roomId);
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
    this.server.to(socketIds).emit(socketConfig.events.inbox.delete, roomId);
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
    if (message.parent) {
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
  async handleReplyMessage({
    replyToMessageId,
    message,
    clientTempId,
  }: ReplyMessagePayload) {
    this.server
      .to(replyToMessageId)
      .emit(socketConfig.events.message.reply.new, {
        message,
        clientTempId: clientTempId,
      });
    this.server
      .to(replyToMessageId)
      .emit(socketConfig.events.message.reply.count, {
        message,
        clientTempId: clientTempId,
      });
  }

  // pin message events
  @OnEvent(socketConfig.events.message.pin)
  async handlePinMessage({ roomId }: NewMessagePayload) {
    this.server.to(roomId).emit(socketConfig.events.message.pin);
  }

  @SubscribeMessage(socketConfig.events.message.reply.join)
  handleJoinDiscussion(
    @ConnectedSocket() client: Socket,
    @MessageBody() messageId: string,
  ) {
    client.join(messageId);
  }
  @SubscribeMessage(socketConfig.events.message.reply.leave)
  handleLeaveDiscussion(
    @ConnectedSocket() client: Socket,
    @MessageBody() messageId: string,
  ) {
    client.leave(messageId);
  }

  // EVENTS FOR VIDEO CALL
  // Handle join call event
  @SubscribeMessage(socketConfig.events.call.join)
  async handleJoinCall(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    { callId, user, roomId }: { callId: string; user: User; roomId: string },
  ) {
    if (this.meetings[callId]) {
      // Check if user helpdesk already joined call
      const isUserJoined = this.meetings[callId].participants.some(
        (p: ParticipantMeeting) => p.user._id === user._id.toString(),
      );
      if (isUserJoined && this.meetings[callId]?.room?.type == 'HELP_DESK') {
        this.server.to(client.id).emit(socketConfig.events.meeting.block, roomId);
        return;
      }
      const whiteList = this.meetings[callId].whiteList;
      if(whiteList && !whiteList.includes(user._id.toString())) {
        this.server.to(client.id).emit(socketConfig.events.meeting.block, roomId);
        return;
      }
      if(this.meetings[callId]?.room?.type == 'HELP_DESK' && whiteList && whiteList.includes(user._id.toString())){
        this.meetings[callId].whiteList = undefined;
      }
      this.meetings[callId].participants.push({ 
        socketId: client.id, 
        user: {
          _id: user._id.toString(),
          name: user.name,
          avatar: user.avatar,
          status: user.status,
        } 
      });
      
      let startTime = this.meetings[callId].startTime;
      if (!startTime) {
        startTime = new Date();
        this.meetings[callId].startTime = startTime;
        this.callService.callStart({ callId, time: startTime });
      }
      
    } else {
      let roomData = await this.roomService.findById(roomId);
      let participantsIds = roomData?.participants.map((p: any) => p._id.toString());
      let roomType: RoomType = 'NORMAL';
      if(roomData?.isHelpDesk) roomType = 'HELP_DESK'
      if(roomData?.isAnonymous) roomType = 'ANONYMOUS'
      this.meetings[callId] = {
        participants: [
          { 
            socketId: client.id, 
            user: {
              _id: user._id.toString(),
              name: user.name,
              avatar: user.avatar,
              status: user.status,
            }
          }
        ],
        room: {
          _id: roomId,
          participantIds: participantsIds || [],
          type: roomType,
        },
      };
      this.server.emit(socketConfig.events.call.start, roomId);
    }
    this.pushMeetingList({
      type: 'room',
      id: roomId
    })
    this.socketToRoom[client.id] = callId;
    const userInThisRoom: ParticipantMeeting[] = this.meetings[callId].participants.filter(
      (user: ParticipantMeeting) => user.socketId !== client.id,
    );
    client.join(callId);
    this.server.to(client.id).emit(socketConfig.events.call.list_participant, {
      users: userInThisRoom,
      doodleImage: this.meetings[callId]?.doodle?.image,
    });
  }
  private CALLING_TIMEOUT = 30000;
  // Send notify invite_to_call event
  @SubscribeMessage(socketConfig.events.call.invite_to_call)
  async sendNotifyJoinCall(
    @MessageBody()
    payload: {
      users: User[];
      call: any;
      user: User;
      type?: 'help_desk' | 'direct' | 'group';
      message?: string;
    },
  ) {
    const ids = payload.users.map((p) => p._id);
    const socketIds = ids
      .map((p) => this.clients[p.toString()]?.socketIds || [])
      .flat();
    if (socketIds.length > 0) {
      const room = await this.roomService.findById(payload.call?.roomId);
      this.server.to(socketIds).emit(socketConfig.events.call.invite_to_call, {
        call: payload.call,
        user: payload.user,
        type: payload.type,
        message: payload.message,
        room: room,
      });
    }
    // call is roomId => send notify to all user in room
    if(['direct', 'group', undefined].includes(payload.type)) {
      this.server
      .to(payload.call._id)
      .emit(socketConfig.events.call.list_waiting_call, {
        users: payload.users,
      });
      setTimeout(() => {
        const userIds = payload.users.map((p) => p._id);
        this.server
          .to(payload.call._id)
          .emit(socketConfig.events.call.decline_call, {
            roomId: payload.call?.roomId,
            userIds: userIds,
          });
      }, this.CALLING_TIMEOUT);
    }

    // Add whiteList to prevent another user join to call
    if(payload.type === 'help_desk') {
      this.meetings[payload.call._id].whiteList = ids.map(id => id.toString());
      this.pushMeetingList({
        type: 'room',
        id: payload.call?.roomId,
      })
    }

    
  }

  // Decline call
  @SubscribeMessage(socketConfig.events.call.decline_call)
  declineCall(
    @MessageBody()
    payload: {
      roomId: string;
      userId: string;
    },
  ) {
    const socketIds = this.clients[payload.userId]?.socketIds || [];
    this.server.to(socketIds).emit(socketConfig.events.call.decline_call, {
      roomId: payload.roomId,
      userIds: [payload.userId],
    });

    this.server.to(payload.roomId).emit(socketConfig.events.call.decline_call, {
      roomId: payload.roomId,
      userIds: [payload.userId],
    });
  }

  // Send signal event
  @SubscribeMessage(socketConfig.events.call.send_signal)
  sendSignal(
    @MessageBody()
    payload: {
      id: string;
      user: User;
      callerId: string;
      isTurnOnMic: boolean;
      signal: any;
      isShareScreen: boolean;
      isElectron: boolean;
    },
  ) {
    this.server.to(payload.id).emit(socketConfig.events.call.user_joined, {
      signal: payload.signal,
      callerId: payload.callerId,
      user: payload.user,
      isShareScreen: payload.isShareScreen,
      isElectron: payload.isElectron,
      isTurnOnMic: payload.isTurnOnMic,
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
    console.log('returnSignal', payload);
    this.server
      .to(payload.callerId)
      .emit(socketConfig.events.call.receive_return_signal, {
        signal: payload.signal,
        id: client.id,
        user: payload.user,
        isShareScreen: payload.isShareScreen,
      });
  }

  // Event for Mic status change
  @SubscribeMessage(socketConfig.events.call.call_status.mic_change)
  handleMicChange(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      userId: string;
      status: boolean;
      roomId: string;
      directUserId?: string;
    },
  ) {
    let receiver: string | string[] = payload.roomId
    if(payload.directUserId) {
      receiver = this.clients[payload.directUserId]?.socketIds || [];
    }
    this.server
      .to(receiver)
      .emit(socketConfig.events.call.call_status.mic_change, {
        userId: payload.userId,
        status: payload.status,
        roomId: payload.roomId,
      });
  }

  // SHARE_SCREEN
  @SubscribeMessage(socketConfig.events.call.share_screen)
  handleShareScreen(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    const userInRoom = this.meetings[roomId].participants.filter(
      (user: ParticipantMeeting) => user.socketId !== client.id,
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
  handleRequestGetShareScreen(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
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
    const callId = this.socketToRoom[client.id];
    const socketId = payload.socketId;
    this.server.to(socketId).emit(socketConfig.events.call.reject_join_room);
    this.server
      .to(callId)
      .emit(socketConfig.events.call.answered_join_room, socketId);
  }
  // Start doodle
  @SubscribeMessage(socketConfig.events.call.start_doodle)
  handleStartDoodle(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { image_url: string; name: string },
  ) {
    const callId = this.socketToRoom[client.id];
    this.meetings[callId].doodle = {
      image: payload.image_url,
      data: {},
      socketId: client.id,
    };
    this.server.to(callId).emit(socketConfig.events.call.start_doodle, {
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
    const callId = this.socketToRoom[client.id];
    delete this.meetings[callId].doodle;
    this.server.to(callId).emit(socketConfig.events.call.end_doodle, name);
  }
  // Draw doodle
  @SubscribeMessage(socketConfig.events.call.draw_doodle)
  handleDrawDoodle(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { image: any; user: any; color: string },
  ) {
    const callId = this.socketToRoom[client.id];
    if (!this.meetings[callId]?.doodle?.data) return;
    const doodleData = this.meetings[callId]?.doodle?.data;
    if (!doodleData) return;
    if (!doodleData?.[client.id]) {
      doodleData[client.id] = {
        user: payload.user,
        image: payload.image,
        color: payload.color,
      };
    } else {
      doodleData[client.id].image = payload.image;
    }
    this.server.to(callId).emit(socketConfig.events.call.draw_doodle, {
      image: payload.image,
      user: payload.user,
      color: payload.color,
      socketId: client.id,
    });
  }
  // Request get old doodle data
  @SubscribeMessage(socketConfig.events.call.request_get_old_doodle_data)
  handleRequestGetOldDoodleData(@ConnectedSocket() client: Socket) {
    const callId = this.socketToRoom[client.id];
    const doodleData = this.meetings[callId].doodle?.data || {};
    this.server
      .to(client.id)
      .emit(socketConfig.events.call.request_get_old_doodle_data, doodleData);
  }
  // Send doodle share screen
  @SubscribeMessage(socketConfig.events.call.send_doodle_share_screen)
  handleSendDoodleShareScreen(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { image: string; user: any },
  ) {
    const callId = this.socketToRoom[client.id];
    this.server
      .to(callId)
      .emit(socketConfig.events.call.send_doodle_share_screen, payload);
  }
  // Send caption
  @SubscribeMessage(socketConfig.events.call.send_caption)
  handleSendCaption(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const callId = this.socketToRoom[client.id];
    this.server.to(callId).emit(socketConfig.events.call.send_caption, payload);
  }
  private async leaveCall(client: Socket) {
    const callId = this.socketToRoom[client.id];
    const meeting = this.meetings[callId];
    if (!meeting) return;
    // Stop doodle if this user start doodle
    if (meeting?.doodle?.socketId === client.id) {
      delete this.meetings[callId].doodle;
      const nameOfUser = meeting.participants.find(
        (user: ParticipantMeeting) => user.socketId === client.id,
      )?.user?.name;
      this.server
        .to(callId)
        .emit(socketConfig.events.call.end_doodle, nameOfUser);
    }
    const memberLeave = meeting.participants.find((p) => p.socketId === client.id);
    delete this.socketToRoom[client.id];
    const roomId = this.meetings[callId].room._id
    client.leave(callId);
    this.server.emit(socketConfig.events.call.leave, client.id);
    if(meeting.room.type === 'HELP_DESK' && memberLeave?.user.status == UserStatus.ANONYMOUS) {
      this.endMeeting(callId)
      return;
    }
    meeting.participants = meeting.participants.filter(
      (user: ParticipantMeeting) => user.socketId !== client.id,
    );
    this.meetings[callId] = meeting;
    // Check if room is empty then delete room
    if (meeting?.participants?.length === 0) {
      this.endMeeting(callId)
      return;
    }
    this.pushMeetingList({
      type: 'room',
      id: roomId
    })
  }

  private async endMeeting(callId: string) {
    const roomId = this.meetings[callId]?.room?._id
    delete this.meetings[callId];
    this.callService.endCall(callId);
    this.pushMeetingList({

      type: 'room',
      id: roomId
    })
  }


  @OnEvent(socketConfig.events.call.update) // Update call event
  handleUpdateCall(@MessageBody() call: any) {
    this.server.emit(socketConfig.events.call.update, call);
    this.server.emit(socketConfig.events.room.update, {});
  }
  // Leave call event
  @SubscribeMessage(socketConfig.events.call.leave)
  handleLeaveCall(@ConnectedSocket() client: Socket) {
    this.leaveCall(client);
  }

  private async pushMeetingList({ type, id }: {
    type: 'user' | 'room',
    id: string
  }){
    const response: Record<string, {
      participantsIdJoined: string[],
      whiteList: string[] | undefined
    }> = {};
    switch (type) {
      case 'user':
        for (const key in this.meetings) {
          const meeting = this.meetings[key];
          const isHaveMe = meeting.room.participantIds.includes(id);
          if(isHaveMe) {
            response[meeting.room._id] = {
              participantsIdJoined: meeting.participants.map((p) => p.user._id),
              whiteList: meeting.whiteList,
            }
          }
        }
        const userSocketIds = this.clients[id]?.socketIds || [];
        this.server.to(userSocketIds).emit(socketConfig.events.meeting.list, response);
        break;
      case 'room':
        let roomData = await this.roomService.findById(id);
        if(!roomData) return;
        // Get user socket id of room
        let roomParticipantIds: string[] = roomData.participants.map((p: any) => p._id.toString());
        let roomParticipantOnlineSocketIds: string[] = [];
        for (const participantId of roomParticipantIds) {
          const socketIds = this.clients[participantId]?.socketIds || [];
          roomParticipantOnlineSocketIds.push(...socketIds);
        }
        const roomMeetings: Meeting[] = Object.values(this.meetings).filter((m) => m.room._id === id);
        if(roomMeetings.length > 0) {
          for (const meeting of roomMeetings) {
            response[meeting.room._id] = {
              participantsIdJoined: meeting.participants.map((p) => p.user._id),
              whiteList: meeting.whiteList,
            }
          }
          this.server.to(roomParticipantOnlineSocketIds).emit(socketConfig.events.meeting.update, response);
        } else { // If do not have meeting of room => meeting ended
          this.server.to(roomParticipantOnlineSocketIds).emit(socketConfig.events.meeting.end, id);
        }
        break;
      default:
        break;
    }
    
  }
  // End events for call

  // SPEECH TO TEXT
  private recognizeStreams: Record<string, any> = {};
  @SubscribeMessage(socketConfig.events.speech_to_text.start)
  handleStartSpeechToText(
    @MessageBody() language_code: string,
    @ConnectedSocket() client: Socket,
  ) {
    this.recognizeStreams[client.id] = null;
    this.startRecognitionStream(client, language_code);
  }
  @SubscribeMessage(socketConfig.events.speech_to_text.stop)
  handleStopSpeechToText(@ConnectedSocket() client: Socket) {
    this.stopRecognitionStream(client);
  }
  @SubscribeMessage(socketConfig.events.speech_to_text.send_audio)
  handleSendAudio(
    @MessageBody() audioData: any,
    @ConnectedSocket() client: Socket,
  ) {
    const recognizeStream = this.recognizeStreams[client.id];
    if (!recognizeStream) return;
    try {
      recognizeStream.write(audioData.audio);
    } catch (err) {
      logger.error('Error calling google api ' + err, 'SPEECH_TO_TEXT');
    }
  }
  startRecognitionStream(client: Socket, language_code?: string) {
    try {
      this.recognizeStreams[client.id] = speechClient
        .streamingRecognize({
          config: {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: language_code || 'en-US',
            enableWordTimeOffsets: true,
            enableAutomaticPunctuation: true,
            enableWordConfidence: true,
            model: 'command_and_search',
            useEnhanced: true,
          },
          interimResults: true,
        })
        .on('error', console.log)
        .on('data', (data) => {
          const result = data.results[0];
          const isFinal = result.isFinal;

          const transcription = data.results
            .map((result: any) => result.alternatives[0].transcript)
            .join('\n');
          this.server
            .to(client.id)
            .emit(socketConfig.events.speech_to_text.receive_audio_text, {
              text: transcription,
              isFinal: isFinal,
            });
          // if end of utterance, let's restart stream
          // this is a small hack to keep restarting the stream on the server and keep the connection with Google api
          // Google api disconects the stream every five minutes
          if (data.results[0] && data.results[0].isFinal) {
            this.stopRecognitionStream(client);
            this.startRecognitionStream(client, language_code);
          }
        });
    } catch (err) {
      logger.error('Error streaming google api ' + err, 'SPEECH_TO_TEXT');
    }
  }

  stopRecognitionStream(client: Socket) {
    const recognizeStream = this.recognizeStreams[client.id];
    if (recognizeStream) {
      recognizeStream.end();
    }
    delete this.recognizeStreams[client.id];
  }

  // typing event
  @SubscribeMessage(socketConfig.events.typing.update.server)
  handleStartTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    {
      roomId,
      isTyping,
    }: {
      roomId: string;
      isTyping: boolean;
    },
  ) {
    const userId = findUserIdBySocketId(this.clients, client.id);
    this.server.to(roomId).emit(socketConfig.events.typing.update.client, {
      userId,
      isTyping,
    });
  }

  // Space event
  @OnEvent(socketConfig.events.space.notification.new)
  async handleNewSpaceNotify({
    data,
    receiverIds,
  }: {
    data: any;

    receiverIds: string[];
  }) {
    const socketIds = receiverIds
      .map((id) => this.clients[id.toString()]?.socketIds || [])
      .flat();
    console.log('socketIds', socketIds);
    if(socketIds.length > 0){
      this.server
        .to(socketIds)
        .emit(socketConfig.events.space.notification.new, data);
    }
    
  }

  //Remove member
  @OnEvent(socketConfig.events.space.member.remove)
  async handleRemoveMember({
    data,
    receiverIds,
  }: {
    data: any;
    receiverIds: string[];
  }) {
    const socketIds = receiverIds
      .map((id) => this.clients[id.toString()]?.socketIds || [])
      .flat();
    if(socketIds.length > 0) {
      this.server
      .to(socketIds)
      .emit(socketConfig.events.space.member.remove, data);
    }
    
  }

  @OnEvent(socketConfig.events.user.relationship.update)
  async handleUpdateRelationShip({ userIds }: { userIds: string[] }) {
    const socketIds = userIds
      .map((id) => this.clients[id.toString()]?.socketIds || [])
      .flat();
    this.server
      .to(socketIds)
      .emit(socketConfig.events.user.relationship.update, {
        userIds,
      });
  }
  //Update space
  @OnEvent(socketConfig.events.space.update)
  async handleUpdateSpace({
    data,
    receiverIds,
  }: {
    data: any;
    receiverIds: string[];
  }) {
    const socketIds = receiverIds
      .map((id) => this.clients[id.toString()]?.socketIds || [])
      .flat();
      if (socketIds.length > 0) {
        this.server.to(socketIds).emit(socketConfig.events.space.update, data);
      }
    
  }

  //App notification
  @OnEvent(socketConfig.events.app.notification.new)
  async handleNotify({
    data,
    receiverIds,
  }: {
    data: any;

    receiverIds: string[];
  }) {
    const socketIds = receiverIds
      .map((id) => this.clients[id.toString()]?.socketIds || [])
      .flat();
    console.log('socketIds', socketIds);
    if (socketIds.length > 0) {
      this.server
        .to(socketIds)
        .emit(socketConfig.events.app.notification.new, data);
    }
   
  }
  //Station
  @OnEvent(socketConfig.events.station.update)
  async handleUpdateStation({
    data,
    receiverIds,
  }: {
    data: any;
    receiverIds: string[];
  }) {
    const socketIds = receiverIds
      .map((id) => this.clients[id.toString()]?.socketIds || [])
      .flat();
      if (socketIds.length > 0) {
        this.server.to(socketIds).emit(socketConfig.events.station.update, data);
      }
  }

  @OnEvent(socketConfig.events.station.member.remove)
  async handleRemoveMemberStation({
    data,
    receiverIds,
  }: {
    data: any;
    receiverIds: string[];
  }) {
    const socketIds = receiverIds
      .map((id) => this.clients[id.toString()]?.socketIds || [])
      .flat();
      if (socketIds.length > 0) {
        this.server.to(socketIds).emit(socketConfig.events.station.member.remove, data);
      }
    
  }
}

const findUserIdBySocketId = (clients: any, socketId: string) => {
  for (const userId in clients) {
    if (clients[userId].socketIds.includes(socketId)) {
      return userId;
    }
  }
  return null;
};
