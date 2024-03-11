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

export class CreateHelpDeskRoomDto {
  @IsNotEmpty({ message: 'Participants is required' })
  @IsArray({ message: 'Participants must be an array' })
  @IsMongoId({
    each: true,
    message: '$property must be a valid Array ObjectId',
  })
  @ArrayMinSize(1, { message: 'Participants must have at least 1 user' })
  @ArrayUnique()
  readonly participants: Schema.Types.ObjectId[];

  @IsMongoId()
  senderId: string;

  @IsOptional()
  @IsBoolean()
  isHelpDesk?: boolean;

  @IsString()
  businessId: string;
}
