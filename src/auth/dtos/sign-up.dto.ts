import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class SignUpDto {
  @IsEmail()
  email: string;
  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'password too weak, must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character',
  })
  password: string;
}
