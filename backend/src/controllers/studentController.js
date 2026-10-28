const AppError = require("../utils/AppError");
const studentService = require("../services/studentService");
const {
  createStudentSchema,
  updateStudentSchema,
  changeStatusSchema,
  studentIdSchema,
  listStudentsQuerySchema,
} = require("../validators/studentSchemas");

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

async function createStudent(req, res, next) {
  try {
    const data = validate(createStudentSchema, req.body);
    const student = await studentService.createStudent(data);
    return success(res, 201, "Student created successfully.", { student });
  } catch (error) {
    return next(error);
  }
}

async function listStudents(req, res, next) {
  try {
    const query = validate(listStudentsQuerySchema, req.query);
    // 🔴 UPDATED: pass req.user so the service can apply role-based scoping.
    const result = await studentService.listStudents(query, req.user);
    return success(res, 200, "Students retrieved successfully.", result);
  } catch (error) {
    return next(error);
  }
}

async function getStudentById(req, res, next) {
  try {
    const id = validate(studentIdSchema, req.params.id);
    const student = await studentService.getStudentById(id);
    return success(res, 200, "Student retrieved successfully.", { student });
  } catch (error) {
    return next(error);
  }
}

async function updateStudent(req, res, next) {
  try {
    const id = validate(studentIdSchema, req.params.id);
    const data = validate(updateStudentSchema, req.body);
    const student = await studentService.updateStudent(id, data);
    return success(res, 200, "Student updated successfully.", { student });
  } catch (error) {
    return next(error);
  }
}

async function changeStudentStatus(req, res, next) {
  try {
    const id = validate(studentIdSchema, req.params.id);
    const { status } = validate(changeStatusSchema, req.body);
    const student = await studentService.changeStudentStatus(id, status);
    return success(res, 200, "Student status updated successfully.", {
      student,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createStudent,
  listStudents,
  getStudentById,
  updateStudent,
  changeStudentStatus,
};
