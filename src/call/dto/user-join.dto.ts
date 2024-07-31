import { IsMongoId, IsString } from 'class-validator';

export class UserJoinDto {
  @IsString()
  name: string;

  @IsString()
  language: string;

  @IsMongoId()
  callId: string;
}
