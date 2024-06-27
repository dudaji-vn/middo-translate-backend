import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class JoinByLinkDto {
  @ApiProperty()
  @IsString()
  link: string;
}
