import { IsMongoId, IsOptional } from 'class-validator';

export class QueryRoomsDto {
  @IsOptional()
  @IsMongoId()
  spaceId: string;

  @IsOptional()
  @IsMongoId()
  stationId: string;
}
