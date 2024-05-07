export class UpdateContentDto {
  content: string;
  enContent?: string | undefined;
  mentions?: string[] | undefined;
  language?: string | undefined;
}
