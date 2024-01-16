import { ArrayUnique, IsMongoId } from 'class-validator';
import { CreateMessageDto } from './create-message.dto';
import { Schema } from 'mongoose';

export class ForwardMessageDto {
  @IsMongoId({
    each: true,
    message: '$property must be a valid Array ObjectId',
  })
  @ArrayUnique()
  roomIds: Schema.Types.ObjectId[] | string[];
  message: CreateMessageDto;
}
