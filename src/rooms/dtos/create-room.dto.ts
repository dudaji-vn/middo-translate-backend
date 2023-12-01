import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import { Schema } from 'mongoose';

export class CreateRoomDto {
  @IsNotEmpty({ message: 'Participants is required' })
  @IsArray({ message: 'Participants must be an array' })
  @IsMongoId({
    each: true,
    message: '$property must be a valid Array ObjectId',
  })
  @ArrayMinSize(1, { message: 'Participants must have at least 1 user' })
  @ArrayUnique()
  readonly participants: Schema.Types.ObjectId[];

  @IsOptional()
  @IsBoolean()
  readonly isGroup: boolean;

  @IsOptional()
  @IsString({ message: 'Avatar must be a string' })
  avatar?: string;

  @IsString()
  @IsOptional()
  readonly name?: string;
}
