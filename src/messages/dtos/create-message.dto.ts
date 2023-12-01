import { IsMongoId } from 'class-validator';
import { Media } from '../schemas/messages.schema';

export class CreateMessageDto {
  content?: string;
  media: Media[];
  @IsMongoId()
  roomId: string;
  clientTempId: string;
}
