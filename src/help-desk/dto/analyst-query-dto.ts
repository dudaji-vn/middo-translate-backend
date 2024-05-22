import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
} from 'class-validator';

export enum AnalystType {
  LAST_WEEK = 'last-week',
  LAST_MONTH = 'last-month',
  LAST_YEAR = 'last-year',
  CUSTOM = 'custom',
}

export class AnalystQueryDto {
  @IsEnum(AnalystType)
  type: AnalystType;

  @IsMongoId()
  @IsOptional()
  memberId: string;

  domain?: string;
  fromDate?: Date;
  toDate?: Date;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  limit: number;
}

export type AnalystFilterDto = {
  spaceId: string;
  type?: AnalystType;
  fromDate?: Date;
  toDate?: Date;
  fromDomain?: string;
  memberId?: string;
  limit?: number;
};
