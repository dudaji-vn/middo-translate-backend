import { Message } from 'src/messages/schemas/messages.schema';

export type NewMessagePayload = {
  roomId: string;
  message: Message;
  clientTempId: string;
};
