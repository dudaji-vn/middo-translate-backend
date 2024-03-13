import { IsMongoId, IsNumber, Max, Min } from 'class-validator';
import { ObjectId } from 'mongoose';

export class CreateRatingDto {
  @IsNumber()
  @Min(0)
  @Max(5)
  star: number;

  @IsMongoId()
  userId: ObjectId;

  @IsMongoId()
  businessId: ObjectId;
}
