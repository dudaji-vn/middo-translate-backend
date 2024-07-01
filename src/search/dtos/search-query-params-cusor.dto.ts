import { IsEnum, IsMongoId, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export enum SearchByType {
  GROUP = 'group',
  USER = 'user',
  MESSAGE = 'message',
}

export class SearchQueryParamsCursorDto {
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  readonly limit: number;

  @IsOptional()
  readonly cursor: string;

  @IsEnum(SearchByType)
  readonly type: SearchByType;

  @IsString()
  readonly q: string;

  @IsOptional()
  @IsMongoId()
  spaceId: string;

  @IsOptional()
  @IsMongoId()
  stationId: string;
}
