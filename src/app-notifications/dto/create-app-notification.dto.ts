import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateAppNotificationDto {
  @IsMongoId()
  from: string;

  @IsMongoId()
  to: string;

  @IsString()
  @IsOptional()
  link: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsMongoId()
  stationId?: string;
}
