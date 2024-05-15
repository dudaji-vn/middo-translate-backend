export default interface Meeting {
  participants: any[];
  room?: any;
  startTime?: Date;
  doodle?: {
    image?: string;
    data?: Record<string, { user: any; image: string; color: string }>;
    socketId?: string; // User created the doodle
  };
}
