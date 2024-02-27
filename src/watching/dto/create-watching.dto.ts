export class CreateWatchingDto {
  readonly userId: string;
  readonly roomId: string;
  readonly notifyToken: string;
  readonly socketId: string;
}
