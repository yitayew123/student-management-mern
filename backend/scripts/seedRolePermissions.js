/**
 * Seed default role permissions. Idempotent — safe to re-run.
 *
 * - Creates a document for each role with the DEFAULT_ROLE_PERMISSIONS.
 * - If a document already exists, leaves it alone (so admin changes
 *   aren't overwritten on re-seed). Pass --force to reset.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const RolePermission = require("../src/models/RolePermission");
const { DEFAULT_ROLE_PERMISSIONS } = require("../src/config/permissions");

async function seed() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required.");
  }

  const force = process.argv.includes("--force");

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const existing = await RolePermission.findOne({ role });

    if (existing && !force) {
      console.log(
        `Skipping ${role}: already exists (${existing.permissions.length} permissions)`,
      );
      continue;
    }

    if (existing && force) {
      existing.permissions = permissions;
      await existing.save();
      console.log(`Reset ${role}: ${permissions.length} permissions`);
    } else {
      await RolePermission.create({ role, permissions });
      console.log(`Created ${role}: ${permissions.length} permissions`);
    }
  }

  console.log("Seeding complete.");
}

seed()
  .catch((error) => {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
