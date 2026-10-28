require("dotenv").config();

const mongoose = require("mongoose");
const { z } = require("zod");

const { connectDB, disconnectDB } = require("../src/config/db");
const User = require("../src/models/User");
const { hashPassword } = require("../src/utils/password");

// Validate admin credentials from the environment BEFORE touching the DB.
// The seed is meant to run once (or be safely re-run), so a typo in the
// env vars — short password, invalid email — would create a bad admin
// record that's painful to clean up. Zod catches this at startup.
const seedSchema = z.object({
  ADMIN_NAME: z.string().trim().min(2).max(100),

  // .email() enforces format; max(254) matches the schema's own cap
  // so a value that passes here can't fail at save time.
  ADMIN_EMAIL: z.string().trim().email().max(254),

  // min(12): stronger than login passwords because admin compromise
  // is catastrophic. max(72): bcrypt's hard limit — inputs beyond 72
  // bytes are silently truncated, so anything longer is pointless.
  ADMIN_PASSWORD: z.string().min(12).max(72),
});

async function main() {
  const result = seedSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Administrator seed configuration is invalid.");

    // Print ALL issues (not just the first) so the operator can fix
    // the whole env block in one pass instead of iterating.
    for (const issue of result.error.issues) {
      console.error(`${issue.path.join(".")}: ${issue.message}`);
    }

    // exitCode + return (not process.exit) so the finally below still
    // runs — though here it's a no-op since we never connected.
    process.exitCode = 1;
    return;
  }

  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = result.data;

  // Normalize email the same way the schema does on save — otherwise
  // `Admin@X.com` in the env would fail the duplicate lookup and then
  // hit the unique index on insert with a confusing E11000 error.
  const email = ADMIN_EMAIL.toLowerCase();

  await connectDB();

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    // Idempotency: re-running with the same email is a no-op, NOT an
    // error. This makes the script safe to call from deployment
    // pipelines without special-casing "already seeded".
    if (existingUser.role === "admin") {
      console.log("An administrator with this email already exists.");
      return;
    }

    // If a non-admin already owns this email, silently promoting them
    // would be a privilege-escalation footgun (typo in env → random
    // student becomes admin). Fail loudly instead — operator must
    // choose a different email or clean up manually.
    throw new Error(
      "This email belongs to a non-administrator account. No changes were made.",
    );
  }

  // Hash BEFORE create — never store plaintext. Uses the same
  // utils/password function as the login flow, so verify works
  // without any extra coupling.
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  await User.create({
    fullName: ADMIN_NAME,
    email,
    passwordHash,
    role: "admin",
    // Explicit even though it defaults to true — the seed's intent
    // is "this admin is immediately usable", so be explicit rather
    // than relying on schema defaults that might change.
    isActive: true,
  });

  console.log("Administrator account created successfully.");
  console.log(`Email: ${email}`);

  // Deliberately not printed. Echoing the password — even once — puts
  // it in shell history, CI logs, and terminal scrollback. The operator
  // supplied it via env, so they already know it.
  console.log("Password: not displayed");
}

main()
  .catch((error) => {
    console.error("Administrator seeding failed:", error.message);
    // exitCode + not exit() so stdout/stderr flush before the process ends.
    process.exitCode = 1;
  })
  .finally(async () => {
    // Only disconnect if a connection was actually opened — connectDB()
    // may have failed or schema validation may have returned early.
    // Same safety-net pattern used in server.js and the test scripts.
    if (mongoose.connection.readyState !== 0) {
      await disconnectDB();
    }
  });


