import { IsMongoId, IsOptional } from 'class-validator';

export class KeywordQueryParamsDto {
  @IsOptional()
  @IsMongoId()
  stationId: string;

  @IsOptional()
  @IsMongoId()
  spaceId: string;
}
