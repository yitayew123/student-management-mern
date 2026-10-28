const mongoose = require("mongoose");
const { connectDB, disconnectDB } = require("../src/config/db");
const Student = require("../src/models/Student");

async function main() {
  try {
    await connectDB();

    // Fixed sentinel ID so reruns target the same record — makes the
    // test idempotent and greppable for cleanup. Keep it distinct from
    // any real data prefix (e.g., "STU-...").
    const testStudentId = "TEST-PERSIST-001";

    // Look up first, then create only if missing. Doing it this way
    // instead of a blind `create()` avoids E11000 duplicate-key errors
    // on reruns and keeps the test safe to execute repeatedly.
    let student = await Student.findOne({
      studentId: testStudentId,
    });

    if (!student) {
      student = await Student.create({
        studentId: testStudentId,
        firstName: "Persistence",
        lastName: "Test",
        email: "persistence.test@example.com",
        department: "Computer Science",
        status: "active",
      });

      console.log("Test student created.");
    } else {
      console.log("Existing test student found.");
    }

    console.log("Student ID:", student.studentId);
    console.log("Student name:", student.firstName, student.lastName);

    // The actual persistence check: the first `student` may be the
    // in-memory document returned by `create()` (no proof the write
    // landed). This fresh query hits MongoDB and proves the record
    // was truly stored.
    const savedStudent = await Student.findOne({
      studentId: testStudentId,
    });

    if (!savedStudent) {
      throw new Error("Persistence verification failed.");
    }

    console.log("Persistence verification passed.");
  } finally {
    // Close the connection on both the happy path and the error path.
    await disconnectDB();
  }
}

main()
  .catch((error) => {
    console.error("Persistence test failed:", error.message);
    // Set exitCode (not process.exit) so stdout/stderr flush before exit.
    process.exitCode = 1;
  })
  .finally(async () => {
    // Second safety net: if `connectDB()` itself threw, the `finally`
    // inside `main()` never ran. The `readyState` check makes this a
    // no-op when `disconnectDB()` was already called successfully.
    if (mongoose.connection.readyState !== 0) {
      await disconnectDB();
    }
  });
