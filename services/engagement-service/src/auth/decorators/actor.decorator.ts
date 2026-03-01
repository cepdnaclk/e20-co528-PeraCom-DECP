import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export const ActorId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    // Grabs the userId exactly as you defined it in your JwtStrategy!
    return request.user?.sub;
  },
);
