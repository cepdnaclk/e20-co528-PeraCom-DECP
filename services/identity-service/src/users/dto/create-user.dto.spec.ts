import { validate } from "class-validator";
import { CreateUserDto } from "./create-user.dto.js";

describe("CreateUserDto", () => {
  it("email must match university domain @eng.pdn.ac.lk", async () => {
    const dto = new CreateUserDto();
    Object.assign(dto, {
      email: "john@gmail.com",
      first_name: "John",
      last_name: "Doe",
      role: "STUDENT",
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === "email")).toBe(true);
  });

  it("valid university email should pass", async () => {
    const dto = new CreateUserDto();
    Object.assign(dto, {
      email: "john@eng.pdn.ac.lk",
      first_name: "John",
      last_name: "Doe",
      role: "STUDENT",
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it("first_name, last_name, role required", async () => {
    const dto = new CreateUserDto();
    Object.assign(dto, {
      email: "john@eng.pdn.ac.lk",
      first_name: "",
      last_name: "Doe",
      role: "STUDENT",
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === "first_name")).toBe(true);
  });
});
