import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  NotificationPreference,
  type NotificationPreferenceDocument,
} from "./schemas/preference.schema.js";

@Injectable()
export class PreferencesService {
  constructor(
    @InjectModel(NotificationPreference.name)
    private readonly preferenceModel: Model<NotificationPreferenceDocument>,
  ) {}

  // ========================================================================
  // GET USER PREFERENCES (With Default Fallback)
  // ========================================================================
  async getPreferences(actorId: string) {
    let prefs = await this.preferenceModel
      .findOne({ userId: actorId })
      .lean()
      .exec();

    // If they have never saved preferences before, return the schema's default structure
    if (!prefs) {
      prefs = new this.preferenceModel({ userId: actorId }).toObject();
    }

    return prefs;
  }

  // ========================================================================
  // UPDATE PREFERENCES (The Upsert Pattern)
  // ========================================================================
  async updatePreferences(actorId: string, updateData: any) {
    // 🛡️ The 'upsert: true' is enterprise magic.
    // If the document doesn't exist, MongoDB creates it instantly.
    // If it does exist, it merges the new toggles seamlessly.
    const updatedPrefs = await this.preferenceModel
      .findOneAndUpdate(
        { userId: actorId },
        { $set: updateData },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    return updatedPrefs;
  }
}
