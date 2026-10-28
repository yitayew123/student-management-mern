const mongoose = require("mongoose");

const rolePermissionSchema = new mongoose.Schema(
  {
    // One document per role (admin, instructor, student).
    role: {
      type: String,
      required: true,
      unique: true,
      enum: ["admin", "instructor", "student"],
    },

    // Array of permission keys from `config/permissions.js`.
    // Validated against the catalog by the service layer before save.
    permissions: {
      type: [String],
      default: [],
    },

    // Audit trail
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model("RolePermission", rolePermissionSchema);
