import { validate } from "class-validator";
import { QueryUsersDto } from "./query-users.dto.js";

describe("QueryUsersDto", () => {
  it("empty dto should pass (all optional)", async () => {
    const dto = new QueryUsersDto();

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it("page and limit as number strings should pass", async () => {
    const dto = new QueryUsersDto();
    Object.assign(dto, { page: "1", limit: "20" });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it("search and role optional", async () => {
    const dto = new QueryUsersDto();
    Object.assign(dto, { search: "john", role: "STUDENT" });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
