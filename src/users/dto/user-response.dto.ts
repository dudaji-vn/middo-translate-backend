import { Exclude, Expose } from 'class-transformer';

import { UserStatus } from '../schemas/user.schema';

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
  @Expose()
  status: UserStatus;

  @Exclude()
  password: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
