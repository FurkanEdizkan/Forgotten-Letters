import { describe, expect, it } from "vitest";

import {
  loginSchema,
  passwordSchema,
  registerSchema,
  usernameSchema,
  emailSchema,
} from "@/lib/validations/auth";

describe("emailSchema", () => {
  it("lowercases and trims so one address is one account", () => {
    // Without this, Foo@X.com and foo@x.com register as two users and
    // the unique constraint never fires.
    expect(emailSchema.parse("  Foo@Example.COM ")).toBe("foo@example.com");
  });

  it("rejects malformed addresses", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("requires at least 12 characters", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(12)).success).toBe(true);
  });

  it("rejects passwords beyond bcrypt's 72-byte limit", () => {
    // bcrypt silently truncates past 72 bytes; accepting a longer
    // password would give false confidence about its strength.
    expect(passwordSchema.safeParse("a".repeat(73)).success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(72)).success).toBe(true);
  });
});

describe("usernameSchema", () => {
  it("accepts lowercase alphanumerics and underscores", () => {
    expect(usernameSchema.safeParse("trench_rat99").success).toBe(true);
  });

  it("rejects uppercase, spaces, and punctuation", () => {
    for (const bad of ["TrenchRat", "trench rat", "trench-rat", "trench.rat"]) {
      expect(usernameSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it("enforces length bounds", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(25)).success).toBe(false);
  });

  it("rejects reserved names that could impersonate the site", () => {
    for (const reserved of ["admin", "root", "official", "support", "moderator"]) {
      expect(usernameSchema.safeParse(reserved).success, reserved).toBe(false);
    }
  });
});

describe("registerSchema", () => {
  it("accepts a valid signup", () => {
    const r = registerSchema.safeParse({
      username: "trench_rat",
      email: "Soldier@Front.Line",
      password: "correct-horse-battery",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("soldier@front.line");
  });

  it("reports every invalid field at once", () => {
    const r = registerSchema.safeParse({
      username: "ab",
      email: "nope",
      password: "short",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const fields = Object.keys(r.error.flatten().fieldErrors);
      expect(fields.sort()).toEqual(["email", "password", "username"]);
    }
  });
});

describe("loginSchema", () => {
  it("does not apply password strength rules", () => {
    // Login must accept whatever was previously valid; echoing strength
    // rules back on login leaks information about stored passwords.
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(
      true,
    );
  });

  it("still requires a non-empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(
      false,
    );
  });
});
