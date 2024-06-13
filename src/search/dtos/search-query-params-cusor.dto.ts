import { IsMongoId, IsOptional, IsString, Min } from 'class-validator';

import { Transform } from 'class-transformer';

export class SearchQueryParamsCursorDto {
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  readonly limit: number;

  @IsOptional()
  readonly cursor: string;

  @IsString()
  readonly type: 'group' | 'user' | 'message';

  @IsString()
  readonly q: string;

  @IsOptional()
  @IsMongoId()
  spaceId: string;
}
