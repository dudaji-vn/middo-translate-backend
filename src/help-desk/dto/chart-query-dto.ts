import { ObjectId } from 'mongoose';
import { AnalystType } from './analyst-query-dto';
import { Tag } from '../schemas/space.schema';

export class ChartQueryDto {
  type: AnalystType;
  spaceId: string;
  fromDate: Date;
  toDate: Date;
  tags?: Tag[];
}
export class RatingQueryDto {
  businessId: ObjectId;
  fromDate: Date;
  toDate: Date;
  type: AnalystType;
}
