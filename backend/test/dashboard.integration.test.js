const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Student = require("../src/models/Student");
const Course = require("../src/models/Course");
const Enrollment = require("../src/models/Enrollment");
const { getDashboardSummary } = require("../src/services/dashboardService");

// Must be a dedicated test database — this test does a full
// `deleteMany({})` on all three collections to assert the
// empty-DB behavior. Never point this at the dev/prod DB.
//
// Works with a standalone MongoDB (this phase doesn't use
// transactions, so no replica-set requirement).
const TEST_URI = process.env.MONGODB_TEST_URI;

test(
  "dashboard metrics reflect empty data and status changes",
  { skip: !TEST_URI },
  async () => {
    let studentA;
    let studentB;
    let courseA;
    let courseB;

    // Shared term values — required by the Enrollment model AND
    // used in the assertion path (the service doesn't filter by
    // term, but the fixture must supply valid values).
    const academicYear = "2026/2027";
    const semester = "Semester 1";

    try {
      await mongoose.connect(TEST_URI);

      // ── Wipe + init indexes ─────────────────────────────────
      // Full wipe makes the "empty DB → zero metrics" assertion
      // meaningful. Index init is important — the partial unique
      // index on Enrollment must exist before inserting rows,
      // otherwise a duplicate-active-enrollment bug would slip
      // past this test.
      await Promise.all([
        Enrollment.deleteMany({}),
        Student.deleteMany({}),
        Course.deleteMany({}),
      ]);

      await Promise.all([Student.init(), Course.init(), Enrollment.init()]);

      // ── Test 1: empty DB → all zeroes, no activity ──────────
      const emptySummary = await getDashboardSummary();

      assert.deepEqual(emptySummary.metrics, {
        activeStudents: 0,
        activeCourses: 0,
        activeEnrollments: 0,
      });
      assert.deepEqual(emptySummary.recentEnrollments, []);

      // ── Fixtures: 1 active + 1 inactive of each entity ─────
      // ✅ FIXED: `studentId` (not `studentNumber`) — matches the
      // merged Student model. Mongoose silently drops unknown
      // fields, so `studentNumber` previously resulted in a
      // "Student ID is required" ValidationError.
      [studentA, studentB] = await Student.create([
        {
          studentId: "DASH-TEST-001",
          firstName: "Test",
          lastName: "StudentA",
          email: "dash-test-001@example.invalid",
          department: "Computing",
          program: "Software Engineering",
          yearLevel: 1,
          status: "active",
        },
        {
          studentId: "DASH-TEST-002",
          firstName: "Test",
          lastName: "StudentB",
          email: "dash-test-002@example.invalid",
          department: "Computing",
          program: "Software Engineering",
          yearLevel: 1,
          status: "inactive",
        },
      ]);

      // Course fixtures are unchanged — all required fields present.
      // (`instructor` and `enrolledCount` both have model defaults,
      // so omitting them is fine.)
      [courseA, courseB] = await Course.create([
        {
          courseCode: "DASH101",
          title: "Dashboard Test Course A",
          department: "Computing",
          credits: 3,
          semester,
          academicYear,
          capacity: 30,
          status: "active",
        },
        {
          courseCode: "DASH102",
          title: "Dashboard Test Course B",
          department: "Computing",
          credits: 3,
          semester,
          academicYear,
          capacity: 30,
          status: "inactive",
        },
      ]);

      // ── Test 2: one active + one cancelled enrollment ──────
      // ✅ FIXED: `academicYear` + `semester` added — the merged
      // Enrollment model requires both (they're part of the
      // partial unique index too, so omitting them would throw
      // "Academic year is required").
      await Enrollment.create([
        {
          student: studentA._id,
          course: courseA._id,
          academicYear,
          semester,
          status: "enrolled",
          // Distinct, ordered timestamps — the service sorts by
          // `enrolledAt: -1, _id: -1`, so the A-row (newer) sorts
          // first. That's what the assertion below depends on.
          enrolledAt: new Date("2026-10-22T10:00:00.000Z"),
        },
        {
          student: studentB._id,
          course: courseB._id,
          academicYear,
          semester,
          status: "cancelled",
          enrolledAt: new Date("2026-10-21T10:00:00.000Z"),
          cancelledAt: new Date("2026-10-21T11:00:00.000Z"),
        },
      ]);

      const populatedSummary = await getDashboardSummary();

      // Only the "active/enrolled" rows count — the inactive
      // student, inactive course, and cancelled enrollment are
      // correctly excluded from the metrics.
      assert.deepEqual(populatedSummary.metrics, {
        activeStudents: 1,
        activeCourses: 1,
        activeEnrollments: 1,
      });

      // Recent activity is NOT status-filtered — both rows appear.
      assert.equal(populatedSummary.recentEnrollments.length, 2);

      // Sorted by enrolledAt desc → the A-row (2026-10-22) is first.
      // ✅ FIXED: `studentId` (matches the service projection fix).
      assert.equal(
        populatedSummary.recentEnrollments[0].student.studentId,
        "DASH-TEST-001",
      );
      assert.equal(
        populatedSummary.recentEnrollments[0].course.courseCode,
        "DASH101",
      );

      // Projection allow-list: `email` is NOT one of the projected
      // fields in the aggregation, so it must be absent. Catches
      // accidental field expansion in the $project stage.
      assert.equal(
        Object.hasOwn(populatedSummary.recentEnrollments[0].student, "email"),
        false,
      );

      // ── Test 3: status changes → immediate metric effect ───
      // Flips everything away from "active/enrolled" so the next
      // call should return all zeros. Also verifies the metrics
      // aren't cached between calls.
      await Student.updateOne(
        { _id: studentA._id },
        { $set: { status: "inactive" } },
      );

      await Course.updateOne(
        { _id: courseA._id },
        { $set: { status: "archived" } },
      );

      await Enrollment.updateOne(
        { student: studentA._id, course: courseA._id },
        { $set: { status: "completed" } },
      );

      const changedSummary = await getDashboardSummary();

      assert.deepEqual(changedSummary.metrics, {
        activeStudents: 0,
        activeCourses: 0,
        activeEnrollments: 0,
      });

      // Historic records are still visible in the recent-activity
      // feed — the dashboard doesn't hide cancelled/completed rows.
      // Proves "metrics filter by status" and "activity feed does
      // not" are correctly separated behaviors.
      assert.equal(changedSummary.recentEnrollments.length, 2);
    } finally {
      // Cleanup runs on both success and failure. Uses optional
      // chaining because a fixture-create failure leaves some
      // fixtures undefined — `.filter(Boolean)` drops those from
      // the `$in` array.
      //
      // This leaves any pre-existing records the test didn't
      // create — but since the setup did `deleteMany({})`, that's
      // a moot point. The `if readyState === 1` guard ensures we
      // don't try to clean up a DB we never connected to.
      if (mongoose.connection.readyState === 1) {
        await Promise.all([
          Enrollment.deleteMany({
            student: { $in: [studentA?._id, studentB?._id].filter(Boolean) },
          }),
          Student.deleteMany({
            _id: { $in: [studentA?._id, studentB?._id].filter(Boolean) },
          }),
          Course.deleteMany({
            _id: { $in: [courseA?._id, courseB?._id].filter(Boolean) },
          }),
        ]);
      }

      await mongoose.disconnect();
    }
  },
);
