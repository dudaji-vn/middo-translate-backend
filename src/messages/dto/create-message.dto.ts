import { Media, MessageType } from '../schemas/messages.schema';

import { IsMongoId } from 'class-validator';

export class CreateMessageDto {
  content?: string;
  contentEnglish?: string;
  media: Media[];
  @IsMongoId()
  roomId: string;
  clientTempId: string;
  type?: MessageType;
  targetUserIds?: string[];
  language?: string;
  callId?: string;
}
