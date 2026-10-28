const Student = require("../models/Student");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const AppError = require("../utils/AppError");
const { countActiveEnrollmentsForStudent } = require("./enrollmentService");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function handleDatabaseError(error) {
  if (error instanceof AppError) throw error;

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];
    const messages = {
      studentId: "This student ID is already registered",
      email: "This email address is already registered",
    };
    throw new AppError(
      messages[field] || "A record with this value already exists",
      409,
      "DUPLICATE_STUDENT",
    );
  }

  if (error.name === "ValidationError") {
    throw new AppError("The student data is invalid", 400, "VALIDATION_ERROR");
  }
  if (error.name === "CastError") {
    throw new AppError("The student ID is invalid", 400, "INVALID_ID");
  }

  throw error;
}

async function createStudent(data) {
  try {
    return await Student.create(data);
  } catch (error) {
    handleDatabaseError(error);
  }
}

/**
 * List students with role-based scoping.
 *
 * @param {object} query — validated query params (status, search, page…)
 * @param {object} user  — `req.user` = { id, email, role, permissions }
 *
 * SCOPE RULES:
 *   - students.read          → see ALL students (admin default)
 *   - students.read_assigned → see only students enrolled in own
 *                              courses (instructor default)
 *   - students.read_own      → REJECT (students should use /auth/me,
 *                              not this list endpoint)
 *   - none of the above      → 403 FORBIDDEN (fail closed)
 *
 * The scope filter is applied AFTER client filters so client input
 * can never widen what they see.
 */
async function listStudents(query, user) {
  const filter = {};
  const perms = user?.permissions ?? [];

  // ── Client filters first ──────────────────────────────────
  if (query.status) {
    filter.status = query.status;
  }

  if (query.search) {
    const expression = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [
      { firstName: expression },
      { lastName: expression },
      { studentId: expression },
      { email: expression },
    ];
  }

  // ── Scoping last — overrides nothing (different keys) but
  //    ensures access to the endpoint itself is permission-checked.
  //    Uses permissions (not role) so admin-granted permissions
  //    win over the default role policy.
  if (perms.includes("students.read")) {
    // Full read — no additional filter.
  } else if (perms.includes("students.read_assigned")) {
    // Instructor scope: only students enrolled in the instructor's
    // own courses (status "enrolled" — dropped/cancelled are excluded).
    const courseIds = await Course.find({ instructor: user.id }).distinct(
      "_id",
    );
    const studentIds = await Enrollment.find({
      course: { $in: courseIds },
      status: "enrolled",
    }).distinct("student");
    filter._id = { $in: studentIds };
  } else {
    // No read permission at all → 403. Route guard should have
    // blocked this, but defense-in-depth: fail closed if called
    // directly from a script or if the route gate was misconfigured.
    throw new AppError(
      "You do not have permission to view students.",
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

  const [students, total] = await Promise.all([
    Student.find(filter).sort(sort).skip(skip).limit(query.limit).lean(),
    Student.countDocuments(filter),
  ]);

  return {
    students,
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

async function getStudentById(id) {
  const student = await Student.findById(id).lean();
  if (!student) {
    throw new AppError("Student not found", 404, "STUDENT_NOT_FOUND");
  }
  return student;
}

async function updateStudent(id, data) {
  try {
    const student = await Student.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true },
    ).lean();

    if (!student) {
      throw new AppError("Student not found", 404, "STUDENT_NOT_FOUND");
    }
    return student;
  } catch (error) {
    if (error instanceof AppError) throw error;
    handleDatabaseError(error);
  }
}

async function changeStudentStatus(id, status) {
  try {
    if (status === "inactive") {
      const activeCount = await countActiveEnrollmentsForStudent(id);
      if (activeCount > 0) {
        throw new AppError(
          "Cancel or resolve the student's active enrollments before deactivating the student.",
          409,
          "STUDENT_HAS_ACTIVE_ENROLLMENTS",
        );
      }
    }

    const student = await Student.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true },
    ).lean();

    if (!student) {
      throw new AppError("Student not found", 404, "STUDENT_NOT_FOUND");
    }
    return student;
  } catch (error) {
    if (error instanceof AppError) throw error;
    handleDatabaseError(error);
  }
}

module.exports = {
  createStudent,
  listStudents,
  getStudentById,
  updateStudent,
  changeStudentStatus,
};
