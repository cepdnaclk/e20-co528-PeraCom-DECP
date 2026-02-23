import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OAuth2Client } from "google-auth-library";
import { PrismaService } from "../prisma/prisma.service.js";
import { env } from "../config/validateEnv.config.js";

@Injectable()
export class AuthService {
  private client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async loginWithGoogle(idToken: string) {
    let payload;

    // 1. Verify token with Google
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });

      payload = ticket.getPayload();
    } catch (error) {
      throw new UnauthorizedException("Invalid Google Token");
    }

    if (!payload) {
      throw new UnauthorizedException("No payload from Google");
    }

    if (!payload.email_verified) {
      throw new UnauthorizedException("Google email not verified");
    }

    const email = payload.email;

    if (!email) {
      throw new UnauthorizedException("Email missing in Google token");
    }

    console.log("Google google payload:", payload);

    // 2. Check Database for user with email
    const user = await this.prisma.user.findUnique({
      where: { email: email },
    });

    // 3. If user doesn't exist, send the login is failed response.
    if (!user) {
      throw new UnauthorizedException(
        "User not found. Please contact the system administrator.",
      );
    }

    // 4. Generate Internal JWT Passport
    const jwtPayload = { sub: user.id, role: user.role };

    return {
      access_token: this.jwtService.sign(jwtPayload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
      },
    };
  }
}
