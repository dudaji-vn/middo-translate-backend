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
    call: {
      join: 'call.join',
      leave: 'call.leave',
      list_participant: 'call.list',
      send_signal: 'call.send_signal',
      return_signal: 'call.return_signal',
      user_joined: 'call.user_joined',
      receive_return_signal: 'call.receive_return_signal',
      share_screen: 'call.share_screen',
      stop_share_screen: 'call.stop_share_screen',
      answer_share_screen: 'call.answer_share_screen',
      icecandidate: 'call.ice_candidate',
      list_participant_need_add_screen: 'call.list_participant_need_add_screen',
    },
  },
};
