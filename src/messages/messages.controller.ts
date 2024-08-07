import {
  Body,
  Controller,
  Post,
  Delete,
  Query,
  Patch,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtUserId, ParamObjectId, Public } from 'src/common/decorators';
import { CreateMessageDto } from './dto';
import { Message, SenderType } from './schemas/messages.schema';
import { Response } from 'src/common/types';
import { RemoveParamsMessageDto } from './dto/remove-params-message.dto';
import { ReactMessageDto } from './dto/react-message.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';
import { convertMessageRemoved } from './utils/convert-message-removed';
import { CreateHelpDeskMessageDto } from './dto/create-help-desk-message.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { EndConversationDto } from './dto/end-conversation-dto';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('Messages')
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
  async getMessage(
    @JwtUserId() userId: string,
    @ParamObjectId() id: string,
  ): Promise<Response<Message>> {
    const message = await this.messagesService.findById(id);
    return {
      data: convertMessageRemoved(message, userId) as Message,
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

  @Patch(':id/translate')
  async translateMessage(
    @ParamObjectId() id: string,
    @JwtUserId() userId: string,
    @Body() { to }: { to: string },
  ) {
    const message = await this.messagesService.translate(id, userId, to);
    return {
      data: message,
      message: 'Message translated',
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

  @Public()
  @Patch('help-desk/:id/seen')
  async seenMessageHelpDesk(
    @ParamObjectId() id: string,
    @Body() { userId }: { userId: string },
  ) {
    await this.messagesService.seen(id, userId);
    return {
      data: null,
      message: 'Message seen',
    };
  }

  @Get(':id/seen')
  async checkSeen(@JwtUserId() userId: string, @ParamObjectId() id: string) {
    const seen = await this.messagesService.checkSeen(id, userId);
    return {
      data: {
        seen,
      },
    };
  }

  @Public()
  @Get('help-desk/:id/seen/:userId')
  async checkSeenHelpDesk(
    @ParamObjectId('id') id: string,
    @ParamObjectId('userId') userId: string,
  ) {
    const seen = await this.messagesService.checkSeen(id, userId);
    return {
      data: {
        seen,
      },
    };
  }

  @Patch(':id/edit')
  async editMessage(
    @ParamObjectId() id: string,
    @Body() updateContentDto: UpdateContentDto,
  ) {
    const data = await this.messagesService.update(id, {
      content: updateContentDto.content,
      enContent: updateContentDto.enContent,
      mentions: updateContentDto.mentions as any,
      language: updateContentDto.language,
    });
    return {
      data: data,
      message: 'Message edited',
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
  @Post(':id/pin')
  async togglePin(@ParamObjectId() id: string, @JwtUserId() userId: string) {
    const isPin = await this.messagesService.pin(id, userId);
    return {
      data: null,
      message: isPin ? 'Message pinned' : 'Message unpinned',
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
  @Get('pinned/:id')
  async getPinnedMessages(
    @ParamObjectId() roomId: string,
    @JwtUserId() userId: string,
    // @Query('limit') limit: number,
    // @Query('page') page: number,
  ) {
    const pinnedMessages = await this.messagesService.getPinnedMessages(
      roomId,
      userId,
    );
    return {
      data: pinnedMessages,
      message: 'Pinned messages found',
    };
  }
  @Post('get-message-id-from-call-id')
  async getMessageIdFromCallId(
    @JwtUserId() senderId: string,
    @Body() { callId }: { callId: string },
  ) {
    const message = await this.messagesService.findByCallId(callId);
    return {
      data: message?._id,
      message: 'Message created',
    };
  }
  @Public()
  @Post('help-desk')
  async helpDeskCreate(
    @Body() createMessageDto: CreateHelpDeskMessageDto,
  ): Promise<Response<Message>> {
    const { roomId, userId } = createMessageDto;
    const isAccessAnonymousRoom =
      await this.messagesService.isAccessAnonymousRoom(roomId, userId);
    if (!isAccessAnonymousRoom) {
      throw new UnauthorizedException(
        'User has no permission to access this room',
      );
    }
    if (!createMessageDto.senderType) {
      createMessageDto.senderType = SenderType.ANONYMOUS;
    }
    createMessageDto.language = '';

    const message = await this.messagesService.create(
      createMessageDto,
      createMessageDto.userId,
    );

    return {
      data: message,
      message: 'Message created',
    };
  }

  @Public()
  @Post('end-conversation')
  async endConversation(@Body() { roomId, senderId }: EndConversationDto) {
    const data = await this.messagesService.endConversation(roomId, senderId);
    return {
      data: data,
    };
  }

  @Patch(':id/reply/mark-all-as-read')
  async markAsReadAllChild(
    @ParamObjectId() id: string,
    @JwtUserId() userId: string,
  ) {
    await this.messagesService.markAsReadAllChildMessages(id, userId);
    return {
      data: null,
      message: 'Child messages marked as read',
    };
  }
  @Get(':id/reply/unread-count')
  async getUnreadCount(
    @ParamObjectId() id: string,
    @JwtUserId() userId: string,
  ) {
    const count = await this.messagesService.countUnreadChildMessages(
      id,
      userId,
    );
    return {
      data: {
        count,
      },
      message: 'Unread count found',
    };
  }
}
