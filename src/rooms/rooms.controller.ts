import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { JwtUserId, ParamObjectId, Public } from 'src/common/decorators';
import { ListQueryParamsCursorDto } from 'src/common/dto';
import { CursorPaginationInfo, Pagination, Response } from 'src/common/types';
import { CreateRoomDto } from './dto';
import { RoomsService } from './rooms.service';
import { Room } from './schemas/room.schema';
import { MessagesService } from 'src/messages/messages.service';
import {
  ActionTypes,
  Message,
  MessageType,
} from 'src/messages/schemas/messages.schema';
import { UpdateRoomDto, UpdateRoomStatusDto } from './dto/update-room.dto';
import { HelpDeskService } from 'src/help-desk/help-desk.service';
import { CreateHelpDeskRoomDto } from './dto/create-help-desk-room';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly messagesService: MessagesService,
    private readonly helpDeskService: HelpDeskService,
  ) {}
  @Post()
  async createRoom(
    @Body() createRoomDto: CreateRoomDto,
    @JwtUserId() userId: string,
  ): Promise<Response<Room>> {
    const room = await this.roomsService.createRoom(createRoomDto, userId);
    if (room.isGroup) {
      this.messagesService.createAction({
        roomId: room._id.toString(),
        action: ActionTypes.CREATE_GROUP,
        senderId: userId,
      });
    }
    return { data: room, message: 'Room created' };
  }

  @Public()
  @Post('create-help-desk-room')
  async createHelpDeskRoom(@Body() createRoomDto: CreateHelpDeskRoomDto) {
    const room = await this.roomsService.createHelpDeskRoom(
      createRoomDto,
      createRoomDto.senderId,
    );
    if (createRoomDto.businessId) {
      const business = await this.helpDeskService.getBusinessById(
        createRoomDto.businessId,
      );
      if (business) {
        this.messagesService.initHelpDeskConversation(
          {
            clientTempId: '',
            content: business.firstMessage,
            contentEnglish: business.firstMessageEnglish,
            type: MessageType.TEXT,
            roomId: room._id.toString(),
            media: [],
          },
          createRoomDto.senderId,
        );
      }
    }
    return { data: room, message: 'Room created' };
  }

  @Get()
  async getRooms(
    @Query() query: ListQueryParamsCursorDto,
    @JwtUserId() userId: string,
  ): Promise<Response<Pagination<Room, CursorPaginationInfo>>> {
    const data = await this.roomsService.findWithCursorPaginate(query, userId);
    return { data, message: 'Room found' };
  }

  @Get('pin')
  async getPinRooms(@JwtUserId() userId: string): Promise<Response<Room[]>> {
    const rooms = await this.roomsService.getPinnedRooms(userId);
    return { message: 'Rooms found', data: rooms };
  }

  @Get(':id')
  async getRoomById(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ): Promise<Response<Room>> {
    const room = await this.roomsService.findByIdAndUserId(id, userId);
    return { data: room, message: 'Room found' };
  }

  @Public()
  @Get('anonymous/:id')
  async getClientRoom(
    @ParamObjectId('id') id: string,
    @Query('userId') userId: string,
  ) {
    const room = await this.roomsService.findByIdAndUserId(id, userId);
    return { data: room, message: 'Room found' };
  }

  @Public()
  @Get('anonymous/:id/message')
  async getAnonymousMessages(
    @ParamObjectId('id') id: string,
    @Query() query: ListQueryParamsCursorDto,
    @Query('userId') userId: string,
  ): Promise<Response<Pagination<Message, CursorPaginationInfo>>> {
    const data = await this.messagesService.findByRoomIdWithCursorPaginate(
      id,
      userId,
      query,
    );
    return { data, message: 'Room found' };
  }

  @Get(':id/messages')
  async getMessages(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
    @Query() query: ListQueryParamsCursorDto,
  ): Promise<Response<Pagination<Message, CursorPaginationInfo>>> {
    const data = await this.messagesService.findByRoomIdWithCursorPaginate(
      id,
      userId,
      query,
    );
    return { data, message: 'Room found' };
  }

  @Get(':id/cloud/count')
  async getCloudCount(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ): Promise<
    Response<{
      count: number;
      mediaCount: number;
      fileCount: number;
    }>
  > {
    const data = await this.messagesService.getCloudCount(id, userId);
    return {
      data: data,
      message: 'Found',
    };
  }

  @Get(':id/media')
  async getMedia(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
    @Query() query: ListQueryParamsCursorDto,
  ): Promise<Response<Pagination<Message, CursorPaginationInfo>>> {
    const data = await this.messagesService.findMediaWithPagination(
      id,
      userId,
      query,
    );
    return { data, message: 'Found' };
  }

  @Get(':id/files')
  async getFiles(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
    @Query() query: ListQueryParamsCursorDto,
  ): Promise<Response<Pagination<Message, CursorPaginationInfo>>> {
    const data = await this.messagesService.findFilesWithPagination(
      id,
      userId,
      query,
    );
    return { data, message: 'Found' };
  }

  @Patch(':id')
  async updateRoom(
    @ParamObjectId('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @JwtUserId() userId: string,
  ): Promise<Response<Room>> {
    const { room, isRemoveName } = await this.roomsService.updateRoomInfo(
      id,
      updateRoomDto,
      userId,
    );
    if (updateRoomDto.name) {
      this.messagesService.createAction({
        roomId: id,
        senderId: userId,
        action: ActionTypes.UPDATE_GROUP_NAME,
        content: updateRoomDto.name,
      });
    }

    if (isRemoveName) {
      this.messagesService.createAction({
        roomId: id,
        senderId: userId,
        action: ActionTypes.REMOVE_GROUP_NAME,
      });
    }

    if (updateRoomDto.avatar) {
      this.messagesService.createAction({
        roomId: id,
        senderId: userId,
        action: ActionTypes.UPDATE_GROUP_AVATAR,
      });
    }
    return { data: room, message: 'Room updated' };
  }

  @Post(':id/members')
  async addParticipants(
    @ParamObjectId('id') id: string,
    @Body('participants') participants: string[],
    @JwtUserId() userId: string,
  ): Promise<Response<Room>> {
    const room = await this.roomsService.addParticipants(
      id,
      participants,
      userId,
    );
    this.messagesService.createAction({
      roomId: id,
      senderId: userId,
      targetUserIds: participants,
      action: ActionTypes.ADD_USER,
    });
    return { data: room, message: 'Room updated' };
  }

  @Delete(':id/members')
  async removeParticipant(
    @ParamObjectId('id') id: string,
    @Body('userId') userTargetId: string,
    @JwtUserId() currentUserId: string,
  ): Promise<Response<Room>> {
    const room = await this.roomsService.removeParticipant(
      id,
      currentUserId,
      userTargetId,
    );
    this.messagesService.createAction({
      roomId: id,
      senderId: currentUserId,
      targetUserIds: [userTargetId],
      action: ActionTypes.REMOVE_USER,
    });
    return { data: room, message: 'Room updated' };
  }

  @Delete(':id')
  async deleteRoom(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ): Promise<Response<null>> {
    await this.roomsService.deleteRoom(id, userId);
    return { message: 'Room deleted', data: null };
  }

  @Delete(':id/leave')
  async leaveRoom(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ): Promise<Response<null>> {
    const room = await this.roomsService.leaveRoom(id, userId);
    if (room.isGroup) {
      this.messagesService.createAction({
        roomId: id,
        senderId: userId,
        action: ActionTypes.LEAVE_GROUP,
      });
    }
    return { message: 'Room leaved', data: null };
  }
  @Delete(':id/messages')
  async deleteMessages(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ): Promise<Response<null>> {
    await this.messagesService.deleteAllInRoom(id, userId);
    await this.roomsService.deleteRoom(id, userId);
    return { message: 'Messages deleted', data: null };
  }

  @Post(':id/pin')
  async pinRoom(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ): Promise<Response<null>> {
    await this.roomsService.pin(id, userId);
    return { message: 'Room pinned', data: null };
  }

  @Patch(':id/change-status-room')
  async changeRoomStatus(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
    @Body() { status }: UpdateRoomStatusDto,
  ): Promise<Response<null>> {
    await this.roomsService.changeRoomStatus(id, userId, status);
    return { message: 'Changed room status', data: null };
  }
}
