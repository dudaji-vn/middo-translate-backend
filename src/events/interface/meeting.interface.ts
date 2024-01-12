export default interface Meeting {
  participants: any[];
  doodle?: {
    image: string;
    data: any[];
    socketId: string;
  };
}
