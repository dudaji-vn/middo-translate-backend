import { Body, Controller, Post, Delete, Query, Patch } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtUserId, ParamObjectId } from 'src/common/decorators';
import { CreateMessageDto } from './dto';
import { Message } from './schemas/messages.schema';
import { Response } from 'src/common/types';
import { RemoveParamsMessageDto } from './dto/remove-params-message.dto';
import { ReactMessageDto } from './dto/react-message.dto';

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
}
