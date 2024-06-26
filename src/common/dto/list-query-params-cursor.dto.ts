import { IsMongoId, IsOptional, IsString, Min } from 'class-validator';

import { Transform } from 'class-transformer';

export class ListQueryParamsCursorDto {
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  readonly limit: number;

  @IsOptional()
  readonly cursor: string;
  direction: 'forward' | 'backward';
  @IsOptional()
  @IsString({ each: true })
  @Transform(({ value }: { value: string }) => {
    return !value ? [] : value.split(',');
  })
  readonly countries: string[];

  @IsOptional()
  @IsString({ each: true })
  @Transform(({ value }: { value: string }) => {
    return !value ? [] : value.split(',');
  })
  readonly domains: string[];

  @IsOptional()
  @IsMongoId({ each: true })
  @Transform(({ value }: { value: string }) => {
    return !value ? [] : value.split(',');
  })
  readonly tags: string[];
}
