import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service.js";
import { RegisterDto, GoogleAuthDto, UpdateProfileDto } from "./dto/index.js";
import { v4 as uuidv4 } from "uuid";
import type { User } from "@prisma/client";

const JWT_SECRET =
  process.env["JWT_SECRET"] ?? "fallback-secret-change-in-production";
const JWT_REFRESH_SECRET = process.env["JWT_REFRESH_SECRET"] ?? JWT_SECRET;

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user: Partial<User>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new user
   */
  async register(dto: RegisterDto): Promise<TokenResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          { google_id: dto.google_id },
          { reg_number: dto.reg_number },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new ConflictException("Email already registered");
      }
      if (existingUser.google_id === dto.google_id) {
        throw new ConflictException("Google account already registered");
      }
      if (existingUser.reg_number === dto.reg_number) {
        throw new ConflictException("Registration number already exists");
      }
    }

    const user = await this.prisma.user.create({
      data: {
        id: uuidv4(),
        ...dto,
      },
    });

    return this.generateTokens(user);
  }

  /**
   * Authenticate user via Google OAuth
   */
  async googleAuth(dto: GoogleAuthDto): Promise<TokenResponse> {
    // Check if user exists by google_id
    let user = await this.prisma.user.findUnique({
      where: { google_id: dto.google_id },
    });

    if (!user) {
      // Check if email exists but without google_id linked
      user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (user) {
        // Link Google account to existing user
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            google_id: dto.google_id,
            profile_pic: user.profile_pic ?? dto.profile_pic ?? null,
          },
        });
      } else {
        throw new NotFoundException(
          "User not registered. Please complete registration first.",
        );
      }
    }

    return this.generateTokens(user);
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUser(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        socialLinks: true,
        projects: true,
        experiences: true,
        educations: true,
        publications: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ access_token: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      const accessToken = this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
        },
        {
          secret: JWT_SECRET,
          expiresIn: "15m",
        },
      );

      return { access_token: accessToken };
    } catch (error) {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private generateTokens(user: User): TokenResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: JWT_SECRET,
      expiresIn: "15m",
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: JWT_REFRESH_SECRET,
      expiresIn: "7d",
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        profile_pic: user.profile_pic,
      },
    };
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }
}
