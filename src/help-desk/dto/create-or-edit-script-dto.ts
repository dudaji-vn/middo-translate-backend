import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ChatFlowDto } from './create-or-edit-business-dto';

export class CreateOrEditScriptDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  name: string;

  @ApiProperty()
  @IsOptional()
  @ValidateNested()
  @Type(() => ChatFlowDto)
  chatFlow: ChatFlowDto;

  @ApiProperty()
  @IsOptional()
  @IsMongoId()
  scriptId?: string;
}
