const mongoose = require("mongoose");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const AppError = require("../utils/AppError");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function handleDatabaseError(error) {
  if (error instanceof AppError) throw error;

  if (error && error.code === 11000) {
    throw new AppError(
      "A course with this course code already exists.",
      409,
      "DUPLICATE_COURSE_CODE",
    );
  }
  if (error instanceof mongoose.Error.ValidationError) {
    throw new AppError(
      "Course data failed database validation.",
      400,
      "VALIDATION_ERROR",
    );
  }
  if (error instanceof mongoose.Error.CastError) {
    throw new AppError("Invalid course ID.", 400, "INVALID_ID");
  }
  throw error;
}

async function countActiveEnrollments(courseId) {
  return Enrollment.countDocuments({ course: courseId, status: "enrolled" });
}

async function createCourse(data) {
  try {
    return await Course.create(data);
  } catch (error) {
    handleDatabaseError(error);
  }
}

/**
 * List courses with role-based scoping.
 *
 * @param {object} query — validated query params
 * @param {object} user  — `req.user` = { id, email, role, permissions }
 *
 * SCOPE RULES:
 *   - courses.read          → see ALL courses (admin default)
 *   - courses.read_assigned → see only own courses (instructor default)
 *   - student role          → see only active courses (catalog browse)
 *
 * Scoping is applied AFTER client filters so a student's
 * `?status=archived` cannot reveal archived courses.
 */
async function listCourses(query, user) {
  const filter = {};
  const perms = user?.permissions ?? [];

  // ── Client filters first ──────────────────────────────────
  if (query.status) filter.status = query.status;
  if (query.department) {
    filter.department = {
      $regex: `^${escapeRegex(query.department)}$`,
      $options: "i",
    };
  }
  if (query.semester) filter.semester = query.semester;
  if (query.academicYear) filter.academicYear = query.academicYear;
  if (query.search) {
    const searchRegex = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [
      { courseCode: searchRegex },
      { title: searchRegex },
      { description: searchRegex },
      { department: searchRegex },
    ];
  }

  // ── Scoping last — overrides client filter conflicts ─────
  if (perms.includes("courses.read")) {
    // Full read — no additional filter.
  } else if (perms.includes("courses.read_assigned")) {
    // Instructor — only own courses.
    filter.instructor = user.id;
  } else if (user?.role === "student") {
    // Student — active courses only. Force-overrides any status
    // query param they might have sent.
    filter.status = "active";
  } else {
    throw new AppError(
      "You do not have permission to view courses.",
      403,
      "FORBIDDEN",
    );
  }

  const sort = {
    [query.sortBy]: query.order === "asc" ? 1 : -1,
    _id: 1,
  };
  const skip = (query.page - 1) * query.limit;

  const [courses, total] = await Promise.all([
    Course.find(filter).sort(sort).skip(skip).limit(query.limit).lean(),
    Course.countDocuments(filter),
  ]);

  return {
    courses,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      hasNextPage: query.page * query.limit < total,
      hasPreviousPage: query.page > 1,
    },
  };
}

async function getCourseById(id) {
  const course = await Course.findById(id).lean();
  if (!course) {
    throw new AppError("Course not found.", 404, "COURSE_NOT_FOUND");
  }
  return course;
}

/**
 * Update a course.
 *
 * Ownership check: non-admin users can only edit courses they're
 * assigned to. Admin can edit any course.
 *
 * Uses permissions (courses.update) for authorization and role for
 * ownership — because ownership is a data-level check, not a
 * permission-level one. An instructor with courses.update still
 * cannot edit someone else's course.
 */
async function updateCourse(id, data, user) {
  try {
    const existingCourse = await Course.findById(id);
    if (!existingCourse) {
      throw new AppError("Course not found.", 404, "COURSE_NOT_FOUND");
    }

    // 🔴 ADDED: ownership check. Only admins bypass this.
    // - Admin → can edit any course.
    // - Instructor → can edit only courses where instructor === user.id.
    // - Anyone else with courses.update (hypothetical) → treated like
    //   an instructor; must own the course.
    if (
      user?.role !== "admin" &&
      String(existingCourse.instructor) !== String(user?.id)
    ) {
      throw new AppError(
        "You can only edit courses you are assigned to.",
        403,
        "FORBIDDEN",
      );
    }

    // ── Atomic capacity guard (unchanged from earlier) ──────
    const filter = { _id: id };
    if (data.capacity !== undefined) {
      filter.$expr = { $lte: ["$enrolledCount", data.capacity] };
    }

    const updatedCourse = await Course.findOneAndUpdate(
      filter,
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean();

    if (updatedCourse) return updatedCourse;

    // Distinguish not-found from capacity-below-enrollments
    const existing = await Course.findById(id).lean();
    if (!existing) {
      throw new AppError("Course not found.", 404, "COURSE_NOT_FOUND");
    }
    if (data.capacity !== undefined && existing.enrolledCount > data.capacity) {
      throw new AppError(
        `Capacity cannot be lower than the ${existing.enrolledCount} active enrollment(s).`,
        409,
        "CAPACITY_BELOW_ENROLLMENTS",
      );
    }
    throw new AppError(
      "The course could not be updated.",
      409,
      "COURSE_UPDATE_CONFLICT",
    );
  } catch (error) {
    handleDatabaseError(error);
  }
}

/**
 * Change course status. Same ownership model as updateCourse:
 * admins can change any course; instructors only their own.
 */
async function changeCourseStatus(id, status, user) {
  try {
    const existingCourse = await Course.findById(id);
    if (!existingCourse) {
      throw new AppError("Course not found.", 404, "COURSE_NOT_FOUND");
    }

    // 🔴 ADDED: ownership check for instructors.
    if (
      user?.role !== "admin" &&
      String(existingCourse.instructor) !== String(user?.id)
    ) {
      throw new AppError(
        "You can only change the status of courses you are assigned to.",
        403,
        "FORBIDDEN",
      );
    }

    const course = await Course.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true },
    ).lean();

    return course;
  } catch (error) {
    handleDatabaseError(error);
  }
}

async function assertCourseCanAcceptEnrollment(courseId) {
  const course = await Course.findById(courseId);
  if (!course) {
    throw new AppError("Course not found.", 404, "COURSE_NOT_FOUND");
  }
  if (course.status !== "active") {
    throw new AppError(
      "New enrollments are not allowed for an inactive course.",
      409,
      "COURSE_NOT_ACTIVE",
    );
  }
  const activeCount = await countActiveEnrollments(course._id);
  if (activeCount >= course.capacity) {
    throw new AppError(
      "The course has reached its enrollment capacity.",
      409,
      "COURSE_CAPACITY_REACHED",
    );
  }
  return course;
}

module.exports = {
  createCourse,
  listCourses,
  getCourseById,
  updateCourse,
  changeCourseStatus,
  countActiveEnrollments,
  assertCourseCanAcceptEnrollment,
};
