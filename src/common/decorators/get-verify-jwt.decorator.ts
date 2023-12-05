import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import { JwtPayload } from 'src/auth/types';

export const GetVerifyJwt = createParamDecorator(
  (
    _: undefined,
    context: ExecutionContext,
  ): {
    token: string;
    email: string;
  } => {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization.split(' ')[1];
    const user = request.user as JwtPayload;
    return {
      token,
      email: user.id,
    };
  },
);
