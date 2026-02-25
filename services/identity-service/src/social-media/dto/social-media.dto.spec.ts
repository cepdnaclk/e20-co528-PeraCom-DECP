import { validate } from "class-validator";
import {
  CreateSocialLinkDto,
  UpdateSocialLinkDto,
  SocialPlatform,
} from "./social-media.dto.js";

describe("CreateSocialLinkDto", () => {
  it("platform must be valid enum", async () => {
    const dto = new CreateSocialLinkDto();
    Object.assign(dto, {
      platform: "InvalidPlatform",
      url: "https://example.com",
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === "platform")).toBe(true);
  });

  it("url must be valid URL", async () => {
    const dto = new CreateSocialLinkDto();
    Object.assign(dto, {
      platform: SocialPlatform.LinkedIn,
      url: "not-a-url",
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === "url")).toBe(true);
  });

  it("valid dto should pass", async () => {
    const dto = new CreateSocialLinkDto();
    Object.assign(dto, {
      platform: SocialPlatform.LinkedIn,
      url: "https://linkedin.com/in/john",
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});

describe("UpdateSocialLinkDto", () => {
  it("id must be UUID", async () => {
    const dto = new UpdateSocialLinkDto();
    Object.assign(dto, {
      id: "not-uuid",
      platform: SocialPlatform.LinkedIn,
      url: "https://example.com",
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === "id")).toBe(true);
  });

  it("valid dto should pass", async () => {
    const dto = new UpdateSocialLinkDto();
    Object.assign(dto, {
      id: "550e8400-e29b-41d4-a716-446655440000",
      platform: SocialPlatform.GitHub,
      url: "https://github.com/john",
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
