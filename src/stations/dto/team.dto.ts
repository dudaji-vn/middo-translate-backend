import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class TeamDto {
  @ApiProperty()
  @IsString()
  name: string;
}
