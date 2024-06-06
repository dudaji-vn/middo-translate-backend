export const socketConfig = {
  events: {
    client: {
      join: 'client.join',
      list: 'client.list',
      leave: 'client.leave',
    },
    message: {
      new: 'message.new',
      update: 'message.update',
      remove: 'message.remove',
      reply: {
        new: 'message.reply.new',
        join: 'message.reply.join',
        leave: 'message.reply.leave',
        update: 'message.reply.update',
        remove: 'message.reply.remove',
        count: 'message.reply.count',
      },
      pin: 'message.pin',
    },
    room: {
      join: 'room.join',
      update: 'room.update',
      leave: 'room.leave',
      delete: 'room.delete',
      new: 'room.new',
      delete_contact: 'room.delete_contact',
    },
    inbox: {
      new: 'inbox.new',
      update: 'inbox.update',
      delete: 'inbox.delete',
    },
    chat: {
      join: 'chat.join',
      leave: 'chat.leave',
    },
    call: {
      join: 'call.join',
      start: 'call.start',
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
      request_join_room: 'call.request_join_room',
      accept_join_room: 'call.accept_join_room',
      reject_join_room: 'call.reject_join_room',
      answered_join_room: 'call.answered_join_room',
      request_get_share_screen: 'call.request_get_share_screen',
      start_doodle: 'call.start_doodle',
      end_doodle: 'call.end_doodle',
      draw_doodle: 'call.draw_doodle',
      send_doodle_share_screen: 'call.send_doodle_share_screen',
      request_get_old_doodle_data: 'call.request_get_old_doodle_data',
      send_old_doodle_data: 'call.send_old_doodle_data',
      starting_new_call: 'call.starting_new_call',
      meeting_end: 'call.meeting_end',
      invite_to_call: 'call.invite_to_call',
      list_waiting_call: 'call.list_waiting_call',
      decline_call: 'call.decline_call',
      send_caption: 'call.send_caption',
      update: 'call.update',
      call_status: {
        mic_change: 'call.status.mic_change',
      },
    },
    meeting: {
      list: 'meeting.list',
    },
    speech_to_text: {
      start: 'speech_to_text.start',
      stop: 'speech_to_text.stop',
      send_audio: 'speech_to_text.send_audio',
      receive_audio_text: 'speech_to_text.receive_audio_text',
    },
    typing: {
      update: {
        server: 'typing.update.server',
        client: 'typing.update.client',
      },
    },
    space: {
      update: 'space.update',
      notification: {
        new: 'space.notification.new',
      },
      member: {
        remove: 'space.member.remove',
      },
    },
    user: {
      relationship: {
        update: 'user.relationship.update',
      },
    },
    station: {
      update: 'space.update',
      notification: {
        new: 'space.notification.new',
      },
      member: {
        remove: 'space.member.remove',
        leave: 'space.member.leave',
        update: 'space.member.update',
      },
    },
  },
};
