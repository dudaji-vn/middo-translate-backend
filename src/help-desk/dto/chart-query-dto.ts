import { ObjectId } from 'mongoose';
import { AnalystType } from './analyst-query-dto';

export class ChartQueryDto {
  type: AnalystType;
  spaceId: string;
  fromDate: Date;
  toDate: Date;
}
export class RatingQueryDto {
  businessId: ObjectId;
  fromDate: Date;
  toDate: Date;
  type: AnalystType;
}
