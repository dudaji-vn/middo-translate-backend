import { IsString } from 'class-validator';

export class VisitorDto {
  @IsString()
  fromDomain: string;
}
