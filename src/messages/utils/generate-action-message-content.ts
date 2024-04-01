import { ActionTypes } from '../schemas/messages.schema';

export const generateSystemMessageContent = ({
  action,
  content,
}: {
  action: ActionTypes;
  content?: string;
}) => {
  switch (action) {
    case ActionTypes.ADD_USER:
      return ` added`;
    case ActionTypes.REMOVE_USER:
      return ` removed`;
    case ActionTypes.LEAVE_GROUP:
      return ` left the group`;
    case ActionTypes.CREATE_GROUP:
      return ` created the group`;
    case ActionTypes.PIN_MESSAGE:
      return ` pinned a message`;
    case ActionTypes.UNPIN_MESSAGE:
      return ` unpinned a message`;
    case ActionTypes.UPDATE_GROUP_NAME:
      return ` changed the group name to ${content}`;
    case ActionTypes.UPDATE_GROUP_AVATAR:
      return ` updated the group avatar`;
    case ActionTypes.REMOVE_GROUP_NAME:
      return ` removed the group name`;
    default:
      return '';
  }
};
