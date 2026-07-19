/**
 * Auth input schemas.
 *
 * Every server action validates through these before touching the
 * database. Client-side checks are convenience only — these run on the
 * server and are the actual boundary.
 */
import { z } from "zod";

/** Reserved so they cannot be claimed and used to impersonate the site. */
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "root",
  "system",
  "support",
  "help",
  "api",
  "auth",
  "login",
  "logout",
  "register",
  "settings",
  "official",
  "moderator",
  "mod",
  "staff",
  "forgotten-letters",
  "null",
  "undefined",
]);

/**
 * Normalizes *before* validating.
 *
 * A trailing `.transform()` runs after `.email()`, so " foo@x.com " is
 * rejected as malformed rather than trimmed — a real rejection for a
 * stray space users cannot see. Preprocessing trims and lowercases
 * first, which also keeps Foo@x.com and foo@x.com a single account.
 */
export const emailSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.string().min(1, "Email is required").email("Enter a valid email address"),
);

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  // bcrypt silently truncates beyond 72 bytes, so a longer password would
  // give false confidence. Reject rather than quietly cut it.
  .max(72, "Password must be at most 72 characters");

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be at most 24 characters")
  .regex(
    /^[a-z0-9_]+$/,
    "Username may contain only lowercase letters, numbers, and underscores",
  )
  .refine((v) => !RESERVED_USERNAMES.has(v), "That username is reserved");

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // Deliberately not passwordSchema: login must accept whatever was
  // previously valid, and echoing rule violations back on login leaks
  // information about stored passwords.
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
