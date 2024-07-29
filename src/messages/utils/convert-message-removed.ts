import {
  Message,
  MessageStatus,
  MessageType,
} from '../schemas/messages.schema';

export function convertMessageRemoved(
  message: Message | undefined,
  userId: string,
  formIds?: string[],
): Message | undefined {
  if (!message) {
    return undefined;
  }
  if (message.script && message.script.isDeleted) {
    message.script = null;
  }
  const isRemovedForMe = message.removedFor.some((id) => String(id) === userId);
  if (isRemovedForMe) {
    message.content = 'This message was removed';
    message.media = [];
    message.type = MessageType.TEXT;
    message.status = MessageStatus.REMOVED;
    message.contentEnglish = 'This message was removed';
  }
  if (message.form && formIds && formIds?.length) {
    message.form.isSubmitted = formIds.includes(message.form?._id?.toString());
  }
  return message;
}
