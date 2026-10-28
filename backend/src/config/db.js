const mongoose = require("mongoose");
const { env } = require("./env");

// Connect to MongoDB using the validated connection string.
// Disabling bufferCommands means queries fail fast if the DB is down,
// instead of silently queuing for up to 10s (the selection timeout).
async function connectDB() {
  try {
    mongoose.set("bufferCommands", false);

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // fail fast if DB unreachable
    });

    console.log(`MongoDB connected successfully: ${mongoose.connection.name}`);
  } catch (error) {
    console.error("MongoDB connection failed.");
    console.error(`Reason: ${error.message}`);

    // Re-throw so the caller (server bootstrap) can exit with a clear error.
    throw error;
  }
}

// Close the MongoDB connection cleanly.
// No-op if already disconnected (readyState 0), so it's safe to call anytime.
async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("MongoDB connection closed.");
  }
}

module.exports = {
  connectDB,
  disconnectDB,
};
