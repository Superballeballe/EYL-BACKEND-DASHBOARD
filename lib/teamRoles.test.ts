import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTeamRole, roleChangeError } from "./teamRoles";

const admin = { id: "a1", role: "admin" as const, active: true };
const operator = { id: "o1", role: "operator" as const, active: true };

describe("roleChangeError", () => {
  it("lets an admin promote an operator", () => {
    assert.equal(roleChangeError({ actorId: "a0", target: operator, role: "admin", activeAdmins: 1 }), null);
  });

  it("lets an admin demote another admin while one remains", () => {
    assert.equal(roleChangeError({ actorId: "a0", target: admin, role: "operator", activeAdmins: 2 }), null);
  });

  it("refuses demoting the last active admin", () => {
    assert.match(
      roleChangeError({ actorId: "a0", target: admin, role: "operator", activeAdmins: 1 }) ?? "",
      /last admin/,
    );
  });

  it("an inactive admin does not count as the last admin", () => {
    const inactive = { ...admin, active: false };
    assert.equal(roleChangeError({ actorId: "a0", target: inactive, role: "operator", activeAdmins: 1 }), null);
  });

  it("refuses changing your own role", () => {
    assert.match(
      roleChangeError({ actorId: "a1", target: admin, role: "operator", activeAdmins: 3 }) ?? "",
      /your own role/,
    );
  });

  it("refuses a no-op change", () => {
    assert.match(roleChangeError({ actorId: "a0", target: operator, role: "operator", activeAdmins: 1 }) ?? "", /Already/);
  });
});

describe("isTeamRole", () => {
  it("accepts only admin and operator", () => {
    assert.equal(isTeamRole("admin"), true);
    assert.equal(isTeamRole("operator"), true);
    assert.equal(isTeamRole("owner"), false);
    assert.equal(isTeamRole(undefined), false);
  });
});
