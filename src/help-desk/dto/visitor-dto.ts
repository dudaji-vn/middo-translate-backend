import { IsString } from 'class-validator';

export class VisitorDto {
  @IsString()
  domain: string;
}
