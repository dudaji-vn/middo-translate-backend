import { IsString } from 'class-validator';

export class VerifyTokenGoogle {
  @IsString()
  token: string;
  clientID: string;
}
