import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { MemberDto } from './member.dto';

export class CreateOrEditStationDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  avatar: string;

  @ApiProperty()
  backgroundImage: string;

  @ApiProperty()
  @ValidateNested({ each: true })
  @Type(() => MemberDto)
  members: MemberDto[];
}
