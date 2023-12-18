import {
  Message,
  MessageStatus,
  MessageType,
} from '../schemas/messages.schema';

export function convertMessageRemoved(
  message: Message | undefined,
  userId: string,
): Message | undefined {
  if (!message) {
    return undefined;
  }
  const isRemovedForMe = message.removedFor.some((id) => String(id) === userId);
  if (isRemovedForMe) {
    message.content = 'This message was removed';
    message.media = [];
    message.type = MessageType.TEXT;
    message.status = MessageStatus.REMOVED;
    message.contentEnglish = 'This message was removed';
  }
  return message;
}
