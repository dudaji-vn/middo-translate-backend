import { IsString } from 'class-validator';

export class UpdateContentDto {
  @IsString()
  content: string;
  enContent?: string | undefined;
  mentions?: string[] | undefined;
  language?: string | undefined;
}
