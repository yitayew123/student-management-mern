const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createCourseSchema,
  updateCourseSchema,
  changeCourseStatusSchema,
  courseIdSchema,
  listCoursesQuerySchema,
} = require("../src/validators/courseSchemas");

// Baseline valid course object — tests mutate specific fields to
// isolate one rule per test. Includes the space-padded `courseCode`
// on purpose, so every test also exercises the trim+uppercase
// transform. All required fields present, all optional fields
// omitted (so defaults are verified by the default test below).
const validCourse = {
  courseCode: " cs301 ",
  title: "Web Application Development",
  department: "Computer Science",
  credits: 3,
  semester: "Semester 1",
  academicYear: "2026/2027",
  capacity: 30,
};

// ─── createCourseSchema ────────────────────────────────────────
// Verifies the `.transform()` on courseCode actually runs and
// produces the exact stored value. Trims first, then uppercases —
// so " cs301 " becomes "CS301", not " CS301 " or " cs301 ".
// If this test ever fails, every downstream query that relies on
// case-insensitive courseCode lookups is broken.
test("normalizes the course code to uppercase", () => {
  const result = createCourseSchema.safeParse(validCourse);

  assert.equal(result.success, true);
  assert.equal(result.data.courseCode, "CS301");
});

// Verifies the Zod-level defaults fill in when fields are omitted.
// Note: `status` is not in `validCourse` at all — its "active" here
// comes from the schema's `.default("active")`, not the Mongoose
// model default. Both layers default independently, so this test
// confirms the validator layer works without hitting the DB.
test("applies default capacity and status", () => {
  const result = createCourseSchema.safeParse(validCourse);

  assert.equal(result.success, true);
  assert.equal(result.data.capacity, 30);
  assert.equal(result.data.status, "active");
});

// Boundary test: 0 is the smallest integer below `.min(1)`.
// Also a common real-world mistake (typo "0" vs "10"). If this
// passes validation, an empty course could be created and
// silently reject every enrollment — the exact bug the capacity
// guard in courseService.js is meant to prevent.
test("rejects zero capacity", () => {
  const result = createCourseSchema.safeParse({
    ...validCourse,
    capacity: 0,
  });

  assert.equal(result.success, false);
});

// Verifies `.int()` on capacity. A fractional value like 2.5 makes
// no sense semantically, and would break the "count >= capacity"
// comparison in assertCourseCanAcceptEnrollment in odd ways.
test("rejects fractional capacity", () => {
  const result = createCourseSchema.safeParse({
    ...validCourse,
    capacity: 2.5,
  });

  assert.equal(result.success, false);
});

// Verifies `.strict()` on createCourseSchema. Without it, a client
// could sneak `_id`, `enrolledCount`, or `createdAt` into the create
// payload hoping they get persisted. Zod would silently strip them
// (or worse, if passed to Mongoose unfiltered, persist them).
test("rejects unknown course fields", () => {
  const result = createCourseSchema.safeParse({
    ...validCourse,
    unexpectedField: true,
  });

  assert.equal(result.success, false);
});

// ─── updateCourseSchema ────────────────────────────────────────
// Verifies the `.refine()` "at least one field" rule. Without it,
// `PATCH /api/courses/:id` with `{}` would pass validation, run a
// no-op `$set: {}`, and return 200 with the unchanged course —
// confusing for clients and wasteful for the DB.
test("rejects an empty course update", () => {
  const result = updateCourseSchema.safeParse({});

  assert.equal(result.success, false);
});

// ─── changeCourseStatusSchema ─────────────────────────────────
// Verifies the valid path of the enum. "inactive" is one of the
// three allowed states — this test guards against accidentally
// dropping a value from the enum (e.g., during a refactor).
test("accepts a valid status change", () => {
  const result = changeCourseStatusSchema.safeParse({
    status: "inactive",
  });

  assert.equal(result.success, true);
});

// Verifies the enum actually rejects out-of-set values. "disabled"
// is a plausible-sounding but invalid state — this confirms the
// enum blocks it rather than letting it reach the DB where the
// Mongoose enum validator would throw a less-friendly error.
test("rejects an unsupported status", () => {
  const result = changeCourseStatusSchema.safeParse({
    status: "disabled",
  });

  assert.equal(result.success, false);
});

// ─── courseIdSchema (ObjectId validator) ──────────────────────
// A malformed `:id` at the route layer would cause a CastError
// deep inside Mongoose if not caught here. This test ensures the
// regex rejects obviously bad input, giving the client a clean
// 400 INVALID_ID response instead of a 500.
test("rejects malformed course IDs", () => {
  const result = courseIdSchema.safeParse("not-a-mongodb-id");

  assert.equal(result.success, false);
});

// ─── listCoursesQuerySchema ──────────────────────────────────
// Verifies the query-string defaults. `safeParse({})` simulates
// `GET /api/courses` with no query params — pagination, sort, and
// order should all be filled in from the schema, so the list
// endpoint always receives a complete, typed query object.
test("applies pagination defaults", () => {
  const result = listCoursesQuerySchema.safeParse({});

  assert.equal(result.success, true);
  assert.equal(result.data.page, 1);
  assert.equal(result.data.limit, 10);
});

// **NoSQL injection defense test** — `sortBy` is a whitelist.
// "password" isn't on it. If this test ever passes with success:true,
// an attacker could sort by sensitive fields to probe their values
// via response ordering. This is the single most important security
// test in the file.
test("rejects unapproved sorting fields", () => {
  const result = listCoursesQuerySchema.safeParse({
    sortBy: "password",
  });

  assert.equal(result.success, false);
});
