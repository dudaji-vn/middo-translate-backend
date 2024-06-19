import { User } from "src/users/schemas/user.schema";

export interface ParticipantMeeting {
  socketId: string;
  user: {
    _id: string;
    name: string;
    avatar: string;
  }
}
export default interface Meeting {
  participants: ParticipantMeeting[];
  room: {
    _id: string;
    participantIds: string[];
  }
  startTime?: Date;
  doodle?: {
    image?: string;
    data?: Record<string, { user: any; image: string; color: string }>;
    socketId?: string; // User created the doodle
  };
}
