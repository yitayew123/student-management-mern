const AppError = require("../utils/AppError");
const enrollmentService = require("../services/enrollmentService");
const {
  createEnrollmentSchema,
  changeEnrollmentStatusSchema,
  enrollmentIdSchema,
  listEnrollmentsQuerySchema,
} = require("../validators/enrollmentSchemas");

function validate(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const error = new AppError(
      "Request validation failed.",
      400,
      "VALIDATION_ERROR",
    );
    error.details = result.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    throw error;
  }
  return result.data;
}

function success(res, code, message, data) {
  return res.status(code).json({ success: true, message, data });
}

async function create(req, res, next) {
  try {
    const data = validate(createEnrollmentSchema, req.body);
    const enrollment = await enrollmentService.createEnrollment(
      data,
      req.user.id,
    );
    return success(res, 201, "Enrollment created successfully.", {
      enrollment,
    });
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const query = validate(listEnrollmentsQuerySchema, req.query);
    // 🔴 UPDATED: pass req.user for role-based scoping.
    const result = await enrollmentService.listEnrollments(query, req.user);
    return success(res, 200, "Enrollments retrieved successfully.", result);
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const id = validate(enrollmentIdSchema, req.params.id);
    const enrollment = await enrollmentService.getEnrollmentById(id);
    return success(res, 200, "Enrollment retrieved successfully.", {
      enrollment,
    });
  } catch (error) {
    return next(error);
  }
}

async function cancel(req, res, next) {
  try {
    const id = validate(enrollmentIdSchema, req.params.id);
    const { reason } = validate(changeEnrollmentStatusSchema, req.body);
    const enrollment = await enrollmentService.cancelEnrollment(
      id,
      req.user.id,
      reason,
    );
    return success(res, 200, "Enrollment cancelled successfully.", {
      enrollment,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { create, list, getById, cancel };
