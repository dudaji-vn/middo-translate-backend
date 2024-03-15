import { IsOptional, IsString } from 'class-validator';

export class EditClientDto {
  @IsOptional()
  @IsString()
  name: string;

  @IsString()
  phoneNumber: string;

  @IsString()
  userId: string;
}
