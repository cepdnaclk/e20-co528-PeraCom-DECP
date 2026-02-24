import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { env } from "../../config/validateEnv.config.js";
import type { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    // 1. Fetch the user from the database using the token's ID
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, is_active: true },
      select: { id: true },
    });

    // 2. The Zombie Token Check!
    // If the user was deleted, or an Admin flipped is_active to false:
    if (!user) {
      throw new UnauthorizedException(
        "Your account has been suspended or deactivated.",
      );
    }

    // 3. If they pass, attach them to the request
    return {
      userId: payload.sub,
      role: payload.role,
    };
  }
}
