import { IsEnum, IsNotEmpty, IsUrl, IsUUID, Matches } from "class-validator";

export enum SocialPlatform {
  LinkedIn = "LinkedIn",
  GitHub = "GitHub",
  Portfolio = "Portfolio",
  Personal = "Personal",
  Facebook = "Facebook",
  Twitter = "Twitter",
  ResearchGate = "ResearchGate",
  Other = "Other",
}

export class CreateSocialLinkDto {
  @IsNotEmpty()
  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @IsNotEmpty()
  @IsUrl()
  @Matches(/^\s*\S.*$/, { message: "URL cannot be empty or just whitespace" })
  url!: string;
}

export class UpdateSocialLinkDto {
  @IsNotEmpty()
  @IsUUID()
  id!: string;

  @IsNotEmpty()
  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @IsNotEmpty()
  @IsUrl()
  @Matches(/^\s*\S.*$/, { message: "URL cannot be empty or just whitespace" })
  url!: string;
}
