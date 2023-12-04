import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import { JwtPayload } from 'src/auth/types';

export const GetJwtInfo = createParamDecorator(
  (
    _: undefined,
    context: ExecutionContext,
  ): {
    token: string;
    id: string;
  } => {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization.split(' ')[1];
    const user = request.user as JwtPayload;
    return {
      token,
      id: user.id,
    };
  },
);
