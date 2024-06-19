import { IsEnum, IsString } from 'class-validator';

export enum ValidateInviteStatus {
  ACCEPT = 'accept',
  DECLINE = 'decline',
}
export class ValidateInviteDto {
  @IsString()
  token: string;

  @IsEnum(ValidateInviteStatus)
  status: ValidateInviteStatus;
}
