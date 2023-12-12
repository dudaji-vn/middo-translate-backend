import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { JwtUserId, ParamObjectId } from 'src/common/decorators';
import { ListQueryParamsCursorDto } from 'src/common/dtos/list-query-params-cursor.dto';
import { CursorPaginationInfo, Pagination, Response } from 'src/common/types';
import { CreateRoomDto } from './dtos';
import { RoomsService } from './rooms.service';
import { Room } from './schemas/room.schema';
import { MessagesService } from 'src/messages/messages.service';
import { Message, MessageType } from 'src/messages/schemas/messages.schema';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly messagesService: MessagesService,
  ) {}
  @Post()
  async createRoom(
    @Body() createRoomDto: CreateRoomDto,
    @JwtUserId() userId: string,
  ): Promise<Response<Room>> {
    const room = await this.roomsService.createRoom(createRoomDto, userId);
    if (room.isGroup) {
      this.messagesService.create(
        {
          clientTempId: '',
          content: 'has created group',
          type: MessageType.NOTIFICATION,
          roomId: room._id.toString(),
          media: [],
        },
        userId,
      );
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
  @Get(':id')
  async getRoomById(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ): Promise<Response<Room>> {
    console.log(
      '🚀 ~ file: rooms.controller.ts:38 ~ RoomsController ~ id:',
      id,
    );
    const room = await this.roomsService.findByIdAndUserId(id, userId);
    return { data: room, message: 'Room found' };
  }
  @Get(':id/messages')
  async getMessages(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
    @Query() query: ListQueryParamsCursorDto,
  ): Promise<Response<Pagination<Message, CursorPaginationInfo>>> {
    const data =
      await this.messagesService.findMessagesByRoomIdWithCursorPaginate(
        id,
        userId,
        query,
      );
    return { data, message: 'Room found' };
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
      this.messagesService.create(
        {
          clientTempId: '',
          content: 'left group',
          type: MessageType.NOTIFICATION,
          roomId: room._id.toString(),
          media: [],
        },
        userId,
        true,
      );
    }
    return { message: 'Room leaved', data: null };
  }
}
