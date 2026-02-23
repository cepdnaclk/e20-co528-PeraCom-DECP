import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { OAuth2Client } from "google-auth-library";
import { v7 as uuidv7 } from "uuid";
import { PrismaService } from "../prisma/prisma.service.js";
import { publishEvent } from "@decp/event-bus";
import type { BaseEvent } from "@decp/event-bus";

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;
  private readonly clientId: string;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.clientId = this.configService.get<string>("google.clientId") || "";
    this.googleClient = new OAuth2Client(this.clientId);
  }

  async loginWithGoogle(idToken: string) {
    let ticket;
    try {
      // 1. Verify token with Google
      ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
    } catch (error) {
      throw new UnauthorizedException("Invalid Google Token");
    }

    const payload = ticket.getPayload();
    if (!payload) throw new UnauthorizedException("No payload from Google");

    const { sub: googleId, email, given_name, family_name, picture } = payload;

    // 2. Check Database
    let user = await this.prisma.user.findUnique({
      where: { google_id: googleId },
    });

    if (!user) {
      // PATH B: Registration Flow
      const newUserId = uuidv7();

      user = await this.prisma.user.create({
        data: {
          id: newUserId,
          google_id: googleId,
          email: email,
          first_name: given_name || "",
          last_name: family_name || "",
          profile_picture_url: picture,
          role: "STUDENT",
          registration_number: `TEMP-${newUserId.substring(0, 6)}`,
        },
      });

      // 3. Broadcast to Kafka
      const userRegisteredEvent: BaseEvent<any> = {
        eventId: uuidv7(),
        eventType: "UserRegistered",
        eventVersion: "1.0",
        timestamp: new Date().toISOString(),
        producer: "identity-service",
        data: {
          userId: user.id,
          email: user.email,
          role: user.role,
        },
      };

      await publishEvent("identity.user.events", userRegisteredEvent);
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
