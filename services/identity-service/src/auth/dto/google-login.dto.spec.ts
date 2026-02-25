import { validate } from "class-validator";
import { GoogleLoginDto } from "./google-login.dto.js";

describe("GoogleLoginDto", () => {
  it("token required", async () => {
    const dto = new GoogleLoginDto();
    dto.token = "";

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === "token")).toBe(true);
  });

  it("valid token should pass", async () => {
    const dto = new GoogleLoginDto();
    dto.token = "valid-google-id-token";

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
