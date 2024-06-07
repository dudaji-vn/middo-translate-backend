import { IsMongoId, IsOptional, IsString } from 'class-validator';
import { User } from 'src/users/schemas/user.schema';

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

// space:
// description,
// from: user,
// to: data.email,
// link: data.verifyUrl,
