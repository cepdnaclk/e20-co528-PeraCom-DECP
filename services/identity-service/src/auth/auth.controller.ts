import { Controller, Post, Body } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { GoogleLoginDto } from "./dto/google-login.dto.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/google
  @Post("google")
  async googleLogin(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(googleLoginDto.token);
  }
}
