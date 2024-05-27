import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class VisitorDto {
  @IsString()
  domain: string;

  @IsOptional()
  @IsMongoId()
  trackingId: string;
}
