import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
} from 'class-validator';
import { ScopeType } from '../schemas/scope-bot.schema';

export class AccessControlDto {
  @IsMongoId()
  stationId: string;

  @IsMongoId()
  botId: string;

  @IsEnum(ScopeType)
  scopeType: ScopeType;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @ArrayUnique()
  teams: string[];
}
