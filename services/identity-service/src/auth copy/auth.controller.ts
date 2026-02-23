import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { RegisterDto, GoogleAuthDto, UpdateProfileDto } from "./dto/index.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { RolesGuard } from "./guards/roles.guard.js";
import { CurrentUser } from "./decorators/current-user.decorator.js";
import { Roles } from "./decorators/roles.decorator.js";
import { UserRole } from "@prisma/client";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user
   * POST /auth/register
   */
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * Authenticate via Google OAuth
   * POST /auth/google
   */
  @Post("google")
  @HttpCode(HttpStatus.OK)
  async googleAuth(@Body() dto: GoogleAuthDto) {
    return this.authService.googleAuth(dto);
  }

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body("refresh_token") refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  /**
   * Get current user profile
   * GET /auth/profile
   */
  @Get("profile")
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser("id") userId: string) {
    return this.authService.getProfile(userId);
  }

  /**
   * Update current user profile
   * PUT /auth/profile
   */
  @Put("profile")
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser("id") userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(userId, dto);
  }

  /**
   * Get current user info (lightweight)
   * GET /auth/me
   */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: any) {
    return user;
  }

  /**
   * Admin-only endpoint example
   * GET /auth/admin
   */
  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminOnly(@CurrentUser() user: any) {
    return { message: "Admin access granted", user };
  }
}
