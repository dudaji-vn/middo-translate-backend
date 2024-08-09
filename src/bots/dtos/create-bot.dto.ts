import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class CreateBotDto {
  @ApiProperty()
  @IsString()
  @Matches(/\S/, { message: 'Name must not be blank' })
  name: string;

  @ApiProperty()
  @IsString()
  avatar: string;

  @ApiProperty()
  @IsString()
  @Matches(/\S/, { message: 'Name must not be blank' })
  endpoint: string;

  @ApiProperty()
  @IsString()
  description: string;
}
