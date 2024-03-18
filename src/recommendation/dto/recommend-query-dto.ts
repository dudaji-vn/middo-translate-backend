import { IsOptional } from 'class-validator';
import { SearchType } from 'src/search/types';

export class RecommendQueryDto {
  @IsOptional()
  type: SearchType;
}
