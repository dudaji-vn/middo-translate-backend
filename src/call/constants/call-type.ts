export type CallType = 'GROUP' | 'DIRECT' | 'HELP_DESK';

export const CALL_TYPE: {
  GROUP: CallType;
  DIRECT: CallType;
  HELP_DESK: CallType;
} = {
  GROUP: 'GROUP',
  DIRECT: 'DIRECT',
  HELP_DESK: 'HELP_DESK',
};

export const JOIN_TYPE = {
  NEW_CALL: 'NEW_CALL',
  JOIN_ROOM: 'JOIN_ROOM',
};
