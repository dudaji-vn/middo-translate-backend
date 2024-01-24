import {
  BadRequestException,
  ExecutionContext,
  createParamDecorator,
} from '@nestjs/common';

import { isValidObjectId } from 'mongoose';

export const ParamObjectId = createParamDecorator(
  (key: string | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const param = request.params[key || 'id'];
    console.log(param);
    if (isValidObjectId(param)) {
      return param;
    }
    throw new BadRequestException('Invalid ObjectId');
  },
);
