const { env } = require("./config/env");
const app = require("./app");
const { connectDB, disconnectDB } = require("./config/db");

const http = require("node:http");

// Create the HTTP server explicitly (instead of app.listen) so we can
// later call `server.close()` during graceful shutdown.
const server = http.createServer(app);

// Guards against double shutdown (e.g., SIGINT followed by an error).
let isShuttingDown = false;

// Connect to MongoDB first, then start accepting traffic.
// Starting the listener before the DB is ready would let requests
// hit routes that assume a live connection.
async function startServer() {
  try {
    await connectDB();

    // Shutdown may have been triggered while we were connecting
    // (e.g., Ctrl+C pressed during startup) — bail out quietly.
    if (isShuttingDown) {
      return;
    }

    server.listen(env.PORT, () => {
      console.log(`Student Management System API running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error("Application startup failed.");

    // Only set exitCode (not process.exit) so pending logs flush.
    // Do not expose connection details through HTTP responses.
    process.exitCode = 1;
  }
}

// Gracefully close the HTTP server (stop new requests, drain in-flight
// ones), then close the DB connection.
async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`${signal} received. Shutting down gracefully...`);

  try {
    // server.close() only runs its callback once all open connections
    // finish — wrap it in a Promise so we can await it.
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }

    await disconnectDB();

    console.log("Application shutdown completed.");
    process.exitCode = 0;
  } catch (error) {
    console.error("Error during application shutdown:", error.message);
    process.exitCode = 1;
  }
}

// SIGINT = Ctrl+C in a terminal.
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

// SIGTERM = sent by Docker, Kubernetes, PM2, Heroku, etc. on redeploy/stop.
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

// If the server itself errors (e.g., port in use, bind failure),
// log it and run the same shutdown path so the DB connection
// doesn't leak and the process exits cleanly.
server.on("error", (error) => {
  console.error("HTTP server error:", error.message);
  process.exitCode = 1;

  void shutdown("SERVER_ERROR");
});

// `void` marks the promise as intentionally fire-and-forget so
// linters don't complain about a floating promise.
void startServer();
