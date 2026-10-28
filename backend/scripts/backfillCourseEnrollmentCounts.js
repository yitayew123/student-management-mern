require("dotenv").config();

const mongoose = require("mongoose");

const Course = require("../src/models/Course");
const Enrollment = require("../src/models/Enrollment");

// One-time migration: recompute `Course.enrolledCount` from the
// authoritative source (the Enrollment collection) so the atomic
// capacity guard in `createEnrollment` and `updateCourse` has
// accurate data to work with.
//
// Run ONCE, during a maintenance window, with the app stopped or in
// read-only mode. Running it while enrollments are being created
// could cause the counter to lag behind reality — the migration's
// two-phase write (below) would race against new enrollment inserts.
async function backfillCourseEnrollmentCounts() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from the environment.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log("Connected to MongoDB.");

  // ── Phase 1: read the source of truth ───────────────────────
  // One aggregation gives us counts for every course that has
  // active enrollments. Courses with zero active enrollments are
  // NOT in this list (the $group only emits groups that exist).
  // That's fine — the second phase below resets them to 0.
  const counts = await Enrollment.aggregate([
    {
      $match: {
        status: "enrolled",
      },
    },
    {
      $group: {
        _id: "$course",
        count: { $sum: 1 },
      },
    },
  ]);

  // ── Phase 2a: reset ALL counters to zero ────────────────────
  // ⚠️ This is the "belt and braces" zero — it guarantees that any
  // course the second phase doesn't touch (because it has 0 active
  // enrollments) is correctly set to 0, and any course that had a
  // stale `enrolledCount` from a previous bad migration is cleared.
  //
  // ⚠️ TRANSIENT INCONSISTENCY: between this call and the bulkWrite
  // below, EVERY course in the DB temporarily has `enrolledCount: 0`
  // — even those with active enrollments. If the script crashes here
  // (out of disk, network blip, Ctrl+C), the DB is left in a state
  // where the atomic guard would ALLOW over-enrollment. This is why
  // the script must run with the app stopped (no writes can slip in).
  //
  // A safer variant (suggested below) skips this reset and computes
  // zero explicitly for unenrolled courses — eliminating the window.
  await Course.updateMany(
    {},
    {
      $set: { enrolledCount: 0 },
    },
  );

  // ── Phase 2b: write the real counts ─────────────────────────
  // One bulkWrite — much faster than N individual `updateOne` calls,
  // and keeps the writes clustered so the window from 2a is small.
  //
  // `bulkWrite` is NOT atomic across documents — if it fails partway,
  // some courses get the correct count and some remain at 0. This is
  // recoverable (rerun the script), but reinforces why it's a
  // maintenance-window operation.
  if (counts.length > 0) {
    const operations = counts.map((item) => ({
      updateOne: {
        filter: { _id: item._id },
        update: {
          $set: { enrolledCount: item.count },
        },
      },
    }));

    await Course.bulkWrite(operations);
  }

  // ── Phase 3: verify ────────────────────────────────────────
  // Recomputes each course's actual active enrollment count and
  // compares to `enrolledCount`. Any mismatch is a hard failure —
  // the script exits non-zero so a CI/pre-deploy hook can catch it.
  //
  // The `$lookup` uses a pipeline form (with `let` + `$expr`) rather
  // than the simpler `localField`/`foreignField` form because we need
  // to filter by `status: "enrolled"` — the simple form can't express
  // an extra condition. The `$ifNull` in the `$project` handles
  // courses with zero active enrollments (the `$lookup` returns an
  // empty array; `$arrayElemAt` on empty array is undefined).
  const verification = await Course.aggregate([
    {
      $lookup: {
        from: Enrollment.collection.name,
        let: { courseId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$course", "$$courseId"] },
                  { $eq: ["$status", "enrolled"] },
                ],
              },
            },
          },
          { $count: "actualCount" },
        ],
        as: "activeEnrollmentStats",
      },
    },
    {
      $project: {
        courseCode: 1,
        enrolledCount: 1,
        actualCount: {
          $ifNull: [
            { $arrayElemAt: ["$activeEnrollmentStats.actualCount", 0] },
            0,
          ],
        },
      },
    },
    {
      $match: {
        $expr: { $ne: ["$enrolledCount", "$actualCount"] },
      },
    },
  ]);

  if (verification.length > 0) {
    // Include the courseCode list in the error so the operator knows
    // exactly which courses to inspect. Currently the message only
    // shows the count — the actual mismatched docs are lost.
    //
    // Improvement: `console.error(verification)` before throwing, so
    // the failing docs are visible in the migration log.
    throw new Error(
      `Counter verification failed for ${verification.length} course(s).`,
    );
  }

  console.log("Course enrollment counters verified successfully.");
}

backfillCourseEnrollmentCounts()
  .catch((error) => {
    console.error("Counter migration failed:", error.message);
    // `exitCode` (not `process.exit`) so pending stdout/stderr flush
    // before the process ends — otherwise the error message can be
    // truncated in some CI environments.
    process.exitCode = 1;
  })
  .finally(async () => {
    // Runs on both success and failure. `disconnect` is idempotent —
    // safe even if `connect` never succeeded (though it would be a
    // no-op in that case).
    await mongoose.disconnect();
  });
