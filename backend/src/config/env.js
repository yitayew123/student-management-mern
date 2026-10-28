// ─────────────────────────────────────────────────────────────
// Import required packages
// ─────────────────────────────────────────────────────────────

// dotenv: loads variables from a .env file into process.env
const dotenv = require("dotenv");

// Zod: schema-validation library used to validate/coerce env vars
const { z } = require("zod");

// Load .env immediately so process.env is populated before validation runs
dotenv.config();

// ─────────────────────────────────────────────────────────────
// Define the environment variable schema
// ─────────────────────────────────────────────────────────────
// This schema acts as a single source of truth for:
//   1. Which env vars the app requires
//   2. Their allowed types / ranges / formats
//   3. Sensible defaults for optional values
// If validation fails, the app exits early with a clear error message
// — preventing "mystery" runtime bugs caused by missing/malformed config.
const envSchema = z.object({
  // Current runtime mode. Restricting to a fixed enum prevents typos
  // like "prod" or "Production" from silently changing behavior.
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Port the HTTP server will listen on.
  // - z.coerce.number(): converts the string value from process.env
  //   into a number (env vars are always strings).
  // - .int(): rejects decimals.
  // - .min(1).max(65535): enforces the valid TCP port range.
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),

  // MongoDB connection string. Must be a non-empty string.
  // No default — the app cannot function without a database.
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  // Secret key used to sign/verify JWTs.
  // Requiring at least 32 characters enforces a reasonable entropy
  // floor so weak secrets (e.g., "secret123") are rejected.
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must contain at least 32 characters"),

  // How long issued JWTs remain valid.
  // Expressed as a string like "1d", "12h", "30m" (jsonwebtoken format).
  // Defaults to one day.
  JWT_EXPIRES_IN: z.string().min(1).default("1d"),

  // Frontend origin allowed by CORS (used in app.js).
  // Validated as a proper URL to catch common mistakes
  // (e.g., "localhost:5173" without "http://").
  CLIENT_ORIGIN: z.string().url("CLIENT_ORIGIN must be a valid URL"),
});

// ─────────────────────────────────────────────────────────────
// Validate process.env against the schema
// ─────────────────────────────────────────────────────────────
// `safeParse` returns { success, data | error } instead of throwing,
// so we can log every issue at once rather than failing on the first one.
const result = envSchema.safeParse(process.env);

// If any variable is missing or malformed, fail fast:
//   - Print a clear diagnostic for each problem
//   - Exit with non-zero code so orchestration tools (Docker, PM2,
//     Kubernetes, CI) know the startup failed
if (!result.success) {
  console.error("Invalid environment configuration:");

  for (const issue of result.error.issues) {
    // `issue.path` is an array of keys (usually length 1 here),
    // joined with "." for readability (e.g., "JWT_SECRET: ...")
    console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  }

  // Non-zero exit → prevents the app from starting in a broken state
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Freeze and export the validated config
// ─────────────────────────────────────────────────────────────
// Object.freeze prevents accidental mutation of env values at runtime
// (e.g., `env.PORT = 9999` would throw in strict mode / silently fail).
// Every module should import { env } from this file instead of
// reading process.env directly — guaranteeing type-safe, validated values.
const env = Object.freeze(result.data);

module.exports = { env };
