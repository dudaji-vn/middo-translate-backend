import { IsInt, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class PaginationQueryParamsDto {
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  limit: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  currentPage: number;
}
