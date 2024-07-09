import { Type } from 'class-transformer';
import { NodeChatFlowDto } from 'src/help-desk/dto/node-chat-dto';
import {
  ActionTypes,
  Media,
  MessageType,
  SenderType,
} from '../schemas/messages.schema';

import { IsMongoId, ValidateNested } from 'class-validator';

export class CreateMessageDto {
  content?: string;
  enContent?: string;
  contentEnglish?: string;
  media: Media[];
  @IsMongoId()
  roomId: string;
  clientTempId: string;
  type?: MessageType;
  targetUserIds?: string[];
  language?: string;
  forwardOfId?: string;
  callId?: string;
  mentions?: string[];
  action?: ActionTypes;
  senderType?: SenderType;

  @ValidateNested({ each: true })
  @Type(() => NodeChatFlowDto)
  actions?: NodeChatFlowDto[];
}
