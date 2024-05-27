import { IsMongoId } from 'class-validator';

export class ToggleRoomNotificationDto {
  @IsMongoId()
  roomId: string;
}
