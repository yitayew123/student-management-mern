const mongoose = require("mongoose");
const { env } = require("./env");

/**
 * Connect to the MongoDB database configured in the validated environment.
 *
 * Queries fail immediately when the database is unavailable instead of
 * being queued while Mongoose waits for a connection.
 */
async function connectDB() {
  try {
    mongoose.set("bufferCommands", false);

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log(`MongoDB connected successfully: ${mongoose.connection.name}`);
  } catch (error) {
    console.error("MongoDB connection failed.");
    console.error(`Reason: ${error.message}`);

    // Let the server bootstrap or script decide how to handle startup failure.
    throw error;
  }
}

/**
 * Close the MongoDB connection if one is currently open.
 * Safe to call when already disconnected.
 */
async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("MongoDB connection closed.");
  }
}

// Export the connection lifecycle functions for the server and scripts.
module.exports = {
  connectDB,
  disconnectDB,
};
