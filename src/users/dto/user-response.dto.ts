import { Exclude, Expose } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  _id: string;
  @Expose()
  name: string;
  @Expose()
  language: string;
  @Expose()
  email: string;
  @Expose()
  avatar: string;

  @Exclude()
  password: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
