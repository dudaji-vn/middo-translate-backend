import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class AddKeywordDto {
  @IsOptional()
  @IsMongoId()
  stationId: string;

  @IsOptional()
  @IsMongoId()
  spaceId: string;

  @IsString()
  keyword: string;
}
