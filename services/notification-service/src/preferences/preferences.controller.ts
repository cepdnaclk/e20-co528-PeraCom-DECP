import { Controller, Get, Patch, Body, UseGuards, Req } from "@nestjs/common";
import { PreferencesService } from "./preferences.service.js";

@Controller("notifications/preferences")
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  async getPreferences(@Req() req: any) {
    return this.preferencesService.getPreferences(req.user.sub);
  }

  @Patch()
  async updatePreferences(
    @Req() req: any,
    @Body() updateData: any, // In production, validate this with a DTO!
  ) {
    // Expected Payload Example:
    // { "channels.email": false, "categories.social_interactions": false }
    return this.preferencesService.updatePreferences(req.user.sub, updateData);
  }
}
