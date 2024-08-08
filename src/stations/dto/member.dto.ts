import { IsMongoId, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MemberDto {
  @ApiProperty()
  @IsString()
  usernameOrEmail: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  teamName?: string;
}

export class MemberWithUserDto {
  @ApiProperty()
  @IsMongoId()
  userId: string;
}
