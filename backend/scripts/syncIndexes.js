const mongoose = require("mongoose");
const { connectDB, disconnectDB } = require("../src/config/db");

const User = require("../src/models/User");
const Student = require("../src/models/Student");
const Course = require("../src/models/Course");
const Enrollment = require("../src/models/Enrollment");

async function main() {
  try {
    await connectDB();

    // Model.init() forces Mongoose to build the schema's indexes and
    // waits until they exist. Calling it explicitly matters because:
    //   - In production `autoIndex` is usually disabled (performance),
    //     so indexes would otherwise not be created here.
    //   - Unique constraints (email, studentId, courseCode, and the
    //     Enrollment compound key) only take effect once the index
    //     physically exists — inserting before then can let duplicates
    //     slip through silently.
    // Running these before any tests guarantees the constraints are live
    // and prevents flaky "sometimes duplicate slipped in" failures.
    await User.init();
    await Student.init();
    await Course.init();
    await Enrollment.init();

    console.log("All model indexes initialized successfully.");
  } finally {
    // Close the connection on both success and error paths.
    await disconnectDB();
  }
}

main()
  .catch((error) => {
    console.error("Index initialization failed:", error.message);
    // Set exitCode (not process.exit) so stdout/stderr flush before exit.
    process.exitCode = 1;
  })
  .finally(async () => {
    // Safety net: if `connectDB()` threw, the inner `finally` in `main`
    // never ran. The `readyState` check makes this a no-op when
    // `disconnectDB()` was already called successfully.
    if (mongoose.connection.readyState !== 0) {
      await disconnectDB();
    }
  });
