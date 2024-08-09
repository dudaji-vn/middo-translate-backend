import { Message } from 'src/messages/schemas/messages.schema';

export type SummaryBotType = {
  query: Message;
  chatHistory: Message[];
};
