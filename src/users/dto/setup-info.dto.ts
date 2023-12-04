import { IsOptional, IsString } from 'class-validator';

export class SetupInfoDto {
  @IsOptional()
  avatar?: string;
  @IsString()
  readonly name: string;
  @IsString()
  readonly language: string;
}
