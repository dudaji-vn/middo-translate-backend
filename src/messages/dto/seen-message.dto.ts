import { IsArray, IsMongoId } from 'class-validator';

export class SeenMessagesDto {
  @IsArray()
  @IsMongoId({ each: true })
  ids: string[];
}
