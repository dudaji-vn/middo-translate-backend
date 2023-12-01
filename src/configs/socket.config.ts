export const socketConfig = {
  events: {
    message: {
      new: 'message.new',
      update: 'message.update',
      remove: 'message.remove',
    },
    room: {
      join: 'room.join',
      update: 'room.update',
      leave: 'room.leave',
      delete: 'room.delete',
    },
    chat: {
      join: 'chat.join',
      leave: 'chat.leave',
    },
  },
};
