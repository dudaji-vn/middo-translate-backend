import { IsEnum, IsMongoId } from 'class-validator';

export enum AnalystType {
  LAST_WEEK = 'last-week',
  LAST_MONTH = 'last-month',
  LAST_YEAR = 'last-year',
  CUSTOM = 'custom',
}

export class AnalystQueryDto {
  @IsEnum(AnalystType)
  type: AnalystType;

  fromDate?: Date;
  toDate?: Date;
}
