import { CreateMessageDto } from './create-message.dto';

export class CreateHelpDeskMessageDto extends CreateMessageDto {
  userId: string;
}
