import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

import { UserResponseDto } from '../dto/user-response.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class UserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, handler: CallHandler): Observable<any> {
    return handler.handle().pipe(
      map((data: any) => {
        // run something before the response is sent out.
        // Please note that plainToClass is deprecated & is now called plainToInstance

        return plainToInstance(UserResponseDto, data, {
          // By using excludeExtraneousValues we are ensuring that only properties decorated with Expose() decorator are included in response.

          excludeExtraneousValues: true,
        });
      }),
    );
  }
}
