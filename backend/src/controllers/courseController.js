const AppError = require("../utils/AppError");
const courseService = require("../services/courseService");
const {
  createCourseSchema,
  updateCourseSchema,
  changeCourseStatusSchema,
  courseIdSchema,
  listCoursesQuerySchema,
} = require("../validators/courseSchemas");

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
    const data = validate(createCourseSchema, req.body);
    const course = await courseService.createCourse(data);
    return success(res, 201, "Course created successfully.", { course });
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const query = validate(listCoursesQuerySchema, req.query);
    // 🔴 UPDATED: pass req.user for role-based scoping.
    const result = await courseService.listCourses(query, req.user);
    return success(res, 200, "Courses retrieved successfully.", result);
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const id = validate(courseIdSchema, req.params.id);
    const course = await courseService.getCourseById(id);
    return success(res, 200, "Course retrieved successfully.", { course });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const id = validate(courseIdSchema, req.params.id);
    const data = validate(updateCourseSchema, req.body);
    // 🔴 UPDATED: pass req.user for ownership check.
    const course = await courseService.updateCourse(id, data, req.user);
    return success(res, 200, "Course updated successfully.", { course });
  } catch (error) {
    return next(error);
  }
}

async function changeStatus(req, res, next) {
  try {
    const id = validate(courseIdSchema, req.params.id);
    const { status } = validate(changeCourseStatusSchema, req.body);
    // 🔴 UPDATED: pass req.user for ownership check.
    const course = await courseService.changeCourseStatus(id, status, req.user);
    return success(res, 200, "Course status updated successfully.", { course });
  } catch (error) {
    return next(error);
  }
}

module.exports = { create, list, getById, update, changeStatus };
