import { IsMongoId } from 'class-validator';

export class SummarizeContentDto {
  @IsMongoId()
  stationId: string;

  @IsMongoId()
  messageId: string;

  @IsMongoId()
  botId: string;
}
