import { IsString } from 'class-validator';

export class SetupInfoDto {
  @IsString()
  readonly name: string;
  @IsString()
  readonly language: string;
}
