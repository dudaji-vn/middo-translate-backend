import {
  Body,
  Controller,
  Post,
  Delete,
  Query,
  Patch,
  Get,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtUserId, ParamObjectId } from 'src/common/decorators';
import { CreateMessageDto } from './dto';
import { Message } from './schemas/messages.schema';
import { Response } from 'src/common/types';
import { RemoveParamsMessageDto } from './dto/remove-params-message.dto';
import { ReactMessageDto } from './dto/react-message.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}
  @Post()
  async create(
    @JwtUserId() senderId: string,
    @Body() createMessageDto: CreateMessageDto,
  ): Promise<Response<Message>> {
    const message = await this.messagesService.create(
      createMessageDto,
      senderId,
    );

    return {
      data: message,
      message: 'Message created',
    };
  }
  @Get(':id')
  async getMessage(@ParamObjectId() id: string): Promise<Response<Message>> {
    const message = await this.messagesService.findById(id);
    return {
      data: message,
      message: 'Message found',
    };
  }
  @Delete(':id')
  async remove(
    @JwtUserId() userId: string,
    @ParamObjectId() id: string,
    @Query() { type }: RemoveParamsMessageDto,
  ) {
    await this.messagesService.remove(id, userId, type);
    return {
      data: null,
      message: 'Message deleted',
    };
  }

  @Patch(':id/seen')
  async seenMessage(@ParamObjectId() id: string, @JwtUserId() userId: string) {
    await this.messagesService.seen(id, userId);
    return {
      data: null,
      message: 'Message seen',
    };
  }

  @Patch(':id/react')
  async reactMessage(
    @ParamObjectId() id: string,
    @JwtUserId() userId: string,
    @Body() { emoji }: ReactMessageDto,
  ) {
    await this.messagesService.react(id, userId, emoji);
    return {
      data: null,
      message: 'Message reacted',
    };
  }

  @Post(':id/forward')
  async forwardMessage(
    @ParamObjectId() id: string,
    @JwtUserId() userId: string,
    @Body() forwardMessageDto: ForwardMessageDto,
  ) {
    await this.messagesService.forward(id, userId, forwardMessageDto);
    return {
      data: null,
      message: 'Message forwarded',
    };
  }

  @Post(':id/reply')
  async replyMessage(
    @ParamObjectId() id: string,
    @JwtUserId() userId: string,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    await this.messagesService.reply(id, userId, createMessageDto);
    return {
      data: null,
      message: 'Message replied',
    };
  }
  @Get(':id/replies')
  async getReplies(
    @ParamObjectId() id: string,
    @JwtUserId() userId: string,
    // @Query('limit') limit: number,
    // @Query('page') page: number,
  ) {
    const replies = await this.messagesService.getReplies(id, userId);
    return {
      data: replies,
      message: 'Replies found',
    };
  }
}
