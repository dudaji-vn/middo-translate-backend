import { IsArray, IsMongoId } from 'class-validator';
import { SeenMessagesDto } from './seen-message.dto';

export class SeenMessagesHelpDeskDto extends SeenMessagesDto {
  @IsMongoId()
  userId: string;
}
