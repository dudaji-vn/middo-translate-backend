import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RoomStatus } from '../schemas/room.schema';

export class UpdateRoomDto {
  @IsString()
  @IsOptional()
  readonly name?: string;
  @IsString()
  @IsOptional()
  readonly avatar?: string;
}

export class UpdateRoomStatusDto {
  @IsEnum(RoomStatus)
  status: RoomStatus;
}
