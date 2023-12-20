import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { JwtUserId, ParamObjectId } from 'src/common/decorators';
import { ListQueryParamsCursorDto } from 'src/common/dto';
import { CursorPaginationInfo, Pagination, Response } from 'src/common/types';
import { CreateRoomDto } from './dto';
import { RoomsService } from './rooms.service';
import { Room } from './schemas/room.schema';
import { MessagesService } from 'src/messages/messages.service';
import { Message, MessageType } from 'src/messages/schemas/messages.schema';
import { UpdateRoomDto } from './dto/update-room.dto';

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
    const room = await this.roomsService.updateRoomInfo(
      id,
      updateRoomDto,
      userId,
    );
    if (updateRoomDto.name) {
      this.messagesService.createSystemMessage(
        id,
        `change group name to ${updateRoomDto.name}`,
        userId,
      );
    }

    if (updateRoomDto.avatar) {
      this.messagesService.createSystemMessage(
        id,
        `change group avatar`,
        userId,
      );
    }
    return { data: room, message: 'Room updated' };
  }

  @Post(':id/members/add')
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
    this.messagesService.createSystemMessage(
      id,
      `add new members to group`,
      userId,
    );
    return { data: room, message: 'Room updated' };
  }

  @Delete(':id/members/remove')
  async removeParticipant(
    @ParamObjectId('id') id: string,
    @Body('userId') userId: string,
    @JwtUserId() currentUserId: string,
  ): Promise<Response<Room>> {
    const room = await this.roomsService.removeParticipant(
      id,
      currentUserId,
      userId,
    );
    this.messagesService.createSystemMessage(
      id,
      `remove member from group`,
      currentUserId,
    );
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
  @Delete(':id/messages')
  async deleteMessages(
    @ParamObjectId('id') id: string,
    @JwtUserId() userId: string,
  ): Promise<Response<null>> {
    await this.messagesService.deleteAllMessagesInRoom(id, userId);
    return { message: 'Messages deleted', data: null };
  }
}
