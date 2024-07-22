import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { FlowItemType } from '../schemas/chat-flow.schema';
import { Media } from 'src/messages/schemas/messages.schema';

export class DataNodeChatFlowDto {
  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  content: string;

  translations: any;

  @IsOptional()
  media: Media[];
}
export class PositionNodeChatFlowDto {
  @IsOptional()
  x: number;

  @IsOptional()
  y: number;
}
export class NodeChatFlowDto {
  @IsString()
  id: string;

  @IsEnum(FlowItemType)
  type: FlowItemType;

  @ValidateNested()
  @Type(() => DataNodeChatFlowDto)
  data: DataNodeChatFlowDto;

  @IsOptional()
  @IsString()
  parentNode: string;

  @IsOptional()
  @IsString()
  extent: string;

  @IsOptional()
  width: number;

  @IsOptional()
  height: number;

  @ValidateNested()
  @Type(() => PositionNodeChatFlowDto)
  position: PositionNodeChatFlowDto;

  @IsOptional()
  formId: string;

  @IsOptional()
  form: string;
}
