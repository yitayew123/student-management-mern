const User = require("../models/User");
const AppError = require("../utils/AppError");
const { hashPassword } = require("../utils/password");

function handleDatabaseError(error) {
  if (error instanceof AppError) throw error;

  if (error && error.code === 11000) {
    throw new AppError(
      "An account with this email already exists.",
      409,
      "DUPLICATE_USER_EMAIL",
    );
  }

  if (error.name === "ValidationError") {
    throw new AppError("User data is invalid.", 400, "VALIDATION_ERROR");
  }

  if (error.name === "CastError") {
    throw new AppError("Invalid user ID.", 400, "INVALID_ID");
  }

  throw error;
}

async function createUser({ fullName, email, password, role }) {
  try {
    const passwordHash = await hashPassword(password);

    const user = await User.create({
      fullName,
      email,
      passwordHash,
      role,
      isActive: true,
    });

    // Return only public fields — passwordHash must never leave the
    // service layer, even though the schema excludes it by default.
    return {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  } catch (error) {
    handleDatabaseError(error);
  }
}

async function listUsers(query) {
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.status === "active") filter.isActive = true;
  if (query.status === "inactive") filter.isActive = false;

  if (query.search) {
    // Escape regex metacharacters before embedding user input — same
    // pattern as studentService.
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "i");
    filter.$or = [{ fullName: pattern }, { email: pattern }];
  }

  // Stable sort: `_id` tiebreaker prevents records from jumping
  // between pages when sortBy has duplicate values (e.g., same role).
  const sort = {
    [query.sortBy]: query.order === "asc" ? 1 : -1,
    _id: 1,
  };
  const skip = (query.page - 1) * query.limit;

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-passwordHash")
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    users,
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

async function changeUserStatus(id, isActive, actorId) {
  try {
    // Prevent self-deactivation — an admin locking themselves out
    // is unrecoverable without DB access.
    if (String(id) === String(actorId) && !isActive) {
      throw new AppError(
        "You cannot deactivate your own account.",
        400,
        "CANNOT_DEACTIVATE_SELF",
      );
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { isActive } },
      { new: true, runValidators: true },
    )
      .select("-passwordHash")
      .lean();

    if (!user) {
      throw new AppError("User not found.", 404, "USER_NOT_FOUND");
    }

    return user;
  } catch (error) {
    handleDatabaseError(error);
  }
}

module.exports = {
  createUser,
  listUsers,
  changeUserStatus,
};
