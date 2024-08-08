import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsString, Matches, ValidateNested } from 'class-validator';
import { MemberDto } from './member.dto';
import { IsArrayUnique } from 'src/common/validators';
import { TeamDto } from './team.dto';

export class CreateOrEditStationDto {
  @ApiProperty()
  @IsString()
  @Matches(/\S/, { message: 'Name must not be blank' })
  name: string;

  @ApiProperty()
  avatar: string;

  @ApiProperty()
  backgroundImage: string;

  @ApiProperty()
  @ValidateNested({ each: true })
  @Type(() => MemberDto)
  @IsArrayUnique('usernameOrEmail', {
    message: 'Each form field usernameOrEmail must be unique',
  })
  members: MemberDto[];

  @ApiProperty()
  @ValidateNested({ each: true })
  @Type(() => TeamDto)
  @IsArrayUnique('name', {
    message: 'Each form field name must be unique',
  })
  teams: TeamDto[];
}
