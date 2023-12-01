import { IsOptional, Min } from 'class-validator';

import { Transform } from 'class-transformer';

export class ListQueryParamsCursorDto {
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  readonly limit: number;

  @IsOptional()
  readonly cursor: string;
}
