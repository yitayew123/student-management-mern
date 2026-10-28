const AppError = require("../utils/AppError");
const userService = require("../services/userService");
const {
  createUserSchema,
  listUsersQuerySchema,
  changeUserStatusSchema,
  userIdSchema,
} = require("../validators/userSchemas");

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
    const data = validate(createUserSchema, req.body);
    const user = await userService.createUser(data);
    return success(res, 201, "User account created successfully.", { user });
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const query = validate(listUsersQuerySchema, req.query);
    const result = await userService.listUsers(query);
    return success(res, 200, "Users retrieved successfully.", result);
  } catch (error) {
    return next(error);
  }
}

async function changeStatus(req, res, next) {
  try {
    const id = validate(userIdSchema, req.params.id);
    const { isActive } = validate(changeUserStatusSchema, req.body);
    const user = await userService.changeUserStatus(id, isActive, req.user.id);
    return success(res, 200, "User status updated successfully.", { user });
  } catch (error) {
    return next(error);
  }
}

module.exports = { create, list, changeStatus };
