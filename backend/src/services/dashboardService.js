const Student = require("../models/Student");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");

/**
 * Returns dashboard summary metrics and a small recent-enrollment list.
 *
 * Active statuses:
 * - Student: active
 * - Course: active
 * - Enrollment: enrolled
 *
 * Intended for a one-page admin/instructor dashboard. Two parts:
 *   1. Aggregate counters (cheap, indexed, cacheable)
 *   2. Last 5 enrollments with populated student/course refs
 *      (heavier — full pipeline, no index on `enrolledAt`)
 */
async function getDashboardSummary() {
  // All four queries run in parallel — independent of each other,
  // so sequential awaits would triple the endpoint latency.
  const [activeStudents, activeCourses, activeEnrollments, recentEnrollments] =
    await Promise.all([
      // Uses the `{ status, createdAt }` compound index (prefix match).
      Student.countDocuments({ status: "active" }),

      // Uses the `{ status, createdAt }` compound index (prefix match).
      Course.countDocuments({ status: "active" }),

      // ⚠️ No index starts with `{ status: "enrolled" }` alone.
      // Enrollment indexes are `{ student, course, academicYear,
      // semester }`, `{ course, status, createdAt }`, and
      // `{ student, status, createdAt }`. So this countDocuments
      // does a **collection scan**. Fine for hundreds of enrollments;
      // add `enrollmentSchema.index({ status: 1 })` if the count
      // becomes a bottleneck.
      Enrollment.countDocuments({ status: "enrolled" }),

      // ── Recent activity feed ────────────────────────────────
      // Returns the last 5 enrollments REGARDLESS of status — so
      // cancelled/dropped/completed rows appear too. That's correct
      // for an "activity feed" (you want to see recent cancellations
      // alongside new enrollments), but worth noting if the UI
      // expects only active ones.
      Enrollment.aggregate([
        // Sort BEFORE limit — required by MongoDB, but ⚠️ this sort
        // has NO matching index. The only indexes with `enrolledAt`
        // are `{course, status, createdAt}` and `{student, status,
        // createdAt}` — neither covers a bare `enrolledAt: -1`.
        //
        // Consequence: MongoDB must **sort the entire enrollments
        // collection in memory** to find the top 5. For a few
        // hundred rows this is fine. For tens of thousands, it's a
        // per-request full scan.
        //
        // Fix when it matters: add
        //   enrollmentSchema.index({ enrolledAt: -1, _id: -1 })
        // The `_id: -1` tiebreaker keeps the sort stable when two
        // enrollments share the same `enrolledAt` (deterministic
        // "top 5" — no skipped/duplicated rows across calls).
        {
          $sort: {
            enrolledAt: -1,
            _id: -1,
          },
        },
        { $limit: 5 },

        // ── Join: student ──────────────────────────────────────
        // $lookup pulls the full Student document into
        // `studentDetails`. The $project below narrows it down to
        // the fields the UI needs.
        {
          $lookup: {
            from: Student.collection.name,
            localField: "student",
            foreignField: "_id",
            as: "studentDetails",
          },
        },
        // `preserveNullAndEmptyArrays: true` — critical for data-
        // integrity safety. If an enrollment points at a deleted
        // student, the $lookup returns [] and the $unwind would
        // DROP the whole row from the feed. Preserving it means the
        // feed still shows the enrollment (with null student fields
        // in the projection) — better than silently hiding recent
        // activity.
        {
          $unwind: {
            path: "$studentDetails",
            preserveNullAndEmptyArrays: true,
          },
        },

        // ── Join: course (same pattern as student) ────────────
        {
          $lookup: {
            from: Course.collection.name,
            localField: "course",
            foreignField: "_id",
            as: "courseDetails",
          },
        },
        {
          $unwind: {
            path: "$courseDetails",
            preserveNullAndEmptyArrays: true,
          },
        },

        // ── Projection: only the fields the dashboard uses ────
        // Explicit allow-list — never return the full populated
        // docs (they'd include description, capacity, audit
        // fields, etc. that the dashboard doesn't display). This
        // is the same projection discipline as `listEnrollments`.
        {
          $project: {
            _id: 1,
            status: 1,
            enrolledAt: 1,

            student: {
              _id: "$studentDetails._id",
              // ✅ FIXED: `studentId` matches the merged Student
              // model's field name (was previously `studentNumber`,
              // which resolved to undefined — every row returned
              // `null` for the business ID).
              studentId: "$studentDetails.studentId",
              firstName: "$studentDetails.firstName",
              lastName: "$studentDetails.lastName",
            },

            course: {
              _id: "$courseDetails._id",
              courseCode: "$courseDetails.courseCode",
              title: "$courseDetails.title",
            },
          },
        },
      ]),
    ]);

  return {
    metrics: {
      activeStudents,
      activeCourses,
      activeEnrollments,
    },
    recentEnrollments,
  };
}

module.exports = {
  getDashboardSummary,
};
