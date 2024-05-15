import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Validate,
} from 'class-validator';

import { SearchType } from '../types/search-type.type';
import { SpecialCharacterValidator } from 'src/common/validators';
import { Transform } from 'class-transformer';

export class SearchQueryParamsDto {
  @IsString()
  @Validate(SpecialCharacterValidator)
  q: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  limit: number;

  @IsOptional()
  type: SearchType;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  currentPage: number;
}
