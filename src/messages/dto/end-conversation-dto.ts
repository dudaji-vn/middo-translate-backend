import { IsMongoId } from 'class-validator';

export class EndConversationDto {
  @IsMongoId()
  roomId: string;

  @IsMongoId()
  senderId: string;
}
