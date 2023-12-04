import { AuthGuard } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class VerifyTokenGuard extends AuthGuard('jwt-verify') {
  constructor() {
    super();
  }
}
