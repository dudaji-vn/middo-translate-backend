export default interface Meeting {
  participants: any[];
  room?: any;
  doodle?: {
    image: string;
    data: any[];
    socketId: string;
  };
}
