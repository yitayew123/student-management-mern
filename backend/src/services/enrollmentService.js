const mongoose = require("mongoose");
const Enrollment = require("../models/Enrollment");
const Student = require("../models/Student");
const Course = require("../models/Course");
const AppError = require("../utils/AppError");

function handleDatabaseError(error) {
  if (error instanceof AppError) throw error;

  if (error && error.code === 11000) {
    throw new AppError(
      "The student already has an active enrollment in this course.",
      409,
      "DUPLICATE_ACTIVE_ENROLLMENT",
    );
  }
  if (error instanceof mongoose.Error.ValidationError) {
    throw new AppError(
      "Enrollment data failed database validation.",
      400,
      "VALIDATION_ERROR",
    );
  }
  if (error instanceof mongoose.Error.CastError) {
    throw new AppError(
      "Invalid enrollment ID or reference.",
      400,
      "INVALID_ID",
    );
  }
  throw error;
}

async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function createEnrollment(data, actorId = null) {
  try {
    return await withTransaction(async (session) => {
      const student = await Student.findById(data.student).session(session);
      if (!student)
        throw new AppError("Student not found.", 404, "STUDENT_NOT_FOUND");
      if (student.status !== "active") {
        throw new AppError(
          "Enrollment is not allowed for an inactive student.",
          409,
          "STUDENT_NOT_ACTIVE",
        );
      }

      const existingEnrollment = await Enrollment.findOne({
        student: student._id,
        course: data.course,
        academicYear: data.academicYear,
        semester: data.semester,
        status: "enrolled",
      }).session(session);

      if (existingEnrollment) {
        throw new AppError(
          "The student already has an active enrollment in this course.",
          409,
          "DUPLICATE_ACTIVE_ENROLLMENT",
        );
      }

      const course = await Course.findOneAndUpdate(
        {
          _id: data.course,
          status: "active",
          $expr: { $lt: ["$enrolledCount", "$capacity"] },
        },
        { $inc: { enrolledCount: 1 } },
        { new: true, session },
      );

      if (!course) {
        const existingCourse = await Course.findById(data.course).session(
          session,
        );
        if (!existingCourse) {
          throw new AppError("Course not found.", 404, "COURSE_NOT_FOUND");
        }
        if (existingCourse.status !== "active") {
          throw new AppError(
            "New enrollments are not allowed for an inactive course.",
            409,
            "COURSE_NOT_ACTIVE",
          );
        }
        throw new AppError(
          "The course has reached its enrollment capacity.",
          409,
          "COURSE_CAPACITY_REACHED",
        );
      }

      const [enrollment] = await Enrollment.create(
        [
          {
            student: student._id,
            course: course._id,
            academicYear: data.academicYear,
            semester: data.semester,
            status: "enrolled",
            enrolledAt: new Date(),
            createdBy: actorId || null,
          },
        ],
        { session },
      );

      return enrollment;
    });
  } catch (error) {
    handleDatabaseError(error);
  }
}

/**
 * List enrollments with role-based scoping.
 *
 * @param {object} query — validated query params
 * @param {object} user  — `req.user` = { id, role, permissions }
 *
 * SCOPE RULES:
 *   - enrollments.read          → ALL enrollments (admin default)
 *   - enrollments.read_assigned → only enrollments in own courses
 *                                 (instructor default)
 *   - enrollments.read_own      → only own enrollments (student default)
 *
 * Scoping overrides client-supplied filters — a student cannot
 * pass `?student=<otherId>` to see someone else's data.
 */
async function listEnrollments(query, user) {
  const filter = {};
  const perms = user?.permissions ?? [];

  // ── Client filters first ──────────────────────────────────
  if (query.student) filter.student = query.student;
  if (query.course) filter.course = query.course;
  if (query.status) filter.status = query.status;
  if (query.academicYear) filter.academicYear = query.academicYear;
  if (query.semester) filter.semester = query.semester;

  // ── Scoping last — overrides client-supplied filters where
  //    they'd leak data outside the user's permission scope.
  if (perms.includes("enrollments.read")) {
    // Admin: no additional filter.
  } else if (perms.includes("enrollments.read_assigned")) {
    // Instructor: only enrollments in own courses. Force-overrides
    // any client-supplied `course` filter.
    const courseIds = await Course.find({ instructor: user.id }).distinct(
      "_id",
    );
    filter.course = { $in: courseIds };
  } else if (perms.includes("enrollments.read_own")) {
    // Student: own enrollments only. Force-overrides any
    // client-supplied `student` filter.
    filter.student = user.id;
  } else {
    throw new AppError(
      "You do not have permission to view enrollments.",
      403,
      "FORBIDDEN",
    );
  }

  // ── Sort + pagination ─────────────────────────────────────
  const sort = {
    [query.sortBy]: query.order === "asc" ? 1 : -1,
    _id: 1,
  };
  const skip = (query.page - 1) * query.limit;

  // Populate fields are projected for list views (leaner payload).
  const [enrollments, total] = await Promise.all([
    Enrollment.find(filter)
      .populate("student", "studentId firstName lastName email")
      .populate("course", "courseCode title credits department")
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Enrollment.countDocuments(filter),
  ]);

  return {
    enrollments,
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

async function getEnrollmentById(id) {
  const enrollment = await Enrollment.findById(id)
    .populate("student")
    .populate("course")
    .lean();
  if (!enrollment) {
    throw new AppError("Enrollment not found.", 404, "ENROLLMENT_NOT_FOUND");
  }
  return enrollment;
}

async function cancelEnrollment(id, actorId = null, reason = "") {
  try {
    return await withTransaction(async (session) => {
      const enrollment = await Enrollment.findById(id).session(session);
      if (!enrollment) {
        throw new AppError(
          "Enrollment not found.",
          404,
          "ENROLLMENT_NOT_FOUND",
        );
      }
      if (enrollment.status === "cancelled") {
        throw new AppError(
          "This enrollment has already been cancelled.",
          409,
          "ENROLLMENT_ALREADY_CANCELLED",
        );
      }
      if (enrollment.status !== "enrolled") {
        throw new AppError(
          "Only an active enrollment can be cancelled.",
          409,
          "ENROLLMENT_NOT_ACTIVE",
        );
      }

      const updatedEnrollment = await Enrollment.findOneAndUpdate(
        { _id: enrollment._id, status: "enrolled" },
        {
          $set: {
            status: "cancelled",
            cancelledAt: new Date(),
            cancelledBy: actorId || null,
            cancellationReason: reason,
          },
        },
        { new: true, session },
      );

      if (!updatedEnrollment) {
        throw new AppError(
          "Enrollment is no longer active.",
          409,
          "ENROLLMENT_NOT_ACTIVE",
        );
      }

      const course = await Course.findOneAndUpdate(
        { _id: enrollment.course, enrolledCount: { $gt: 0 } },
        { $inc: { enrolledCount: -1 } },
        { new: true, session },
      );

      if (!course) {
        throw new AppError(
          "Course enrollment counter is inconsistent. No changes were committed.",
          409,
          "ENROLLMENT_COUNTER_INCONSISTENT",
        );
      }

      return updatedEnrollment;
    });
  } catch (error) {
    handleDatabaseError(error);
  }
}

async function countActiveEnrollmentsForStudent(studentId, session) {
  let query = Enrollment.countDocuments({
    student: studentId,
    status: "enrolled",
  });
  if (session) query = query.session(session);
  return query;
}

module.exports = {
  createEnrollment,
  listEnrollments,
  getEnrollmentById,
  cancelEnrollment,
  countActiveEnrollmentsForStudent,
};
