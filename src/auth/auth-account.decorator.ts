import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithAuth } from './auth.types';

export const AuthAccountParam = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<RequestWithAuth>();
  return request.authAccount;
});
