# Student Portal Management System

A full-stack web application built with the **MERN stack (MongoDB, Express.js, React, and Node.js)** to manage student records, courses, enrollments, user accounts, and role-based access permissions through a centralized portal.

The system provides separate access for administrators, instructors, and students, with authentication, permission-aware navigation, protected routes, and backend authorization.

## Table of Contents

- [Overview](#overview)
- [Objectives](#objectives)
- [Key Features](#key-features)
- [User Roles](#user-roles)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Application Access](#application-access)
- [API Overview](#api-overview)
- [Authentication and Authorization](#authentication-and-authorization)
- [End-to-End Testing](#end-to-end-testing)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)
- [Future Enhancements](#future-enhancements)
- [License](#license)

## Overview

The Student Portal Management System is designed to simplify academic administration by providing a centralized platform for managing student information, courses, enrollments, and user access.

The application follows a client-server architecture. The React frontend provides the user interface, while the Express.js backend exposes RESTful APIs. MongoDB stores application data, and Mongoose manages database models and queries.

Access to application features is controlled through authentication, role permissions, and protected backend operations.

## Objectives

The main objectives are to:

1. Centralize student, course, and enrollment information.
2. Provide dedicated interfaces for administrators, instructors, and students.
3. Implement secure authentication and authorization.
4. Allow administrators to manage user accounts and role permissions.
5. Validate data and enforce business rules.
6. Provide a responsive and accessible user interface.
7. Demonstrate practical full-stack development using the MERN stack.

## Key Features

### Authentication and account management

- Login using email and password.
- Password hashing and verification.
- JWT-based authentication.
- Current-user profile retrieval.
- Account activation and deactivation.
- Protected frontend routes.
- Backend authentication middleware.

### Student management

- Create and maintain student records.
- View and search student information.
- Update student records.
- Validate required fields and unique identifiers.
- Enforce authorized access to student information.

### Course management

- Create and maintain courses.
- View and search course records.
- Update course information.
- Validate course codes and relevant fields.
- Support course-related business rules where implemented.

### Enrollment management

- Create and view enrollment records.
- Associate students with courses.
- Validate enrollment operations.
- Handle duplicate enrollment attempts.
- Support enrollment status changes and cancellation where implemented.

### Role and permission management

- Support administrator, instructor, and student roles.
- Display navigation links according to effective permissions.
- Allow authorized administrators to manage role permissions.
- Support permission-based route protection.
- Enforce authorization on backend API endpoints.

### Dashboard

- Provide a centralized landing page.
- Display summary information and operational statistics where implemented.
- Present navigation to authorized application modules.

## User Roles

### Administrator

The administrator manages the system and its users.

Typical responsibilities include:

- Managing user accounts.
- Creating instructor and student accounts.
- Managing student records.
- Managing courses and enrollments.
- Configuring role permissions.
- Viewing administrative dashboard information.

### Instructor

The instructor accesses teaching-related information according to the permissions granted.

Potential responsibilities include:

- Viewing assigned courses.
- Accessing authorized student records.
- Viewing enrollments associated with permitted courses.

Instructor assignments and additional teaching functions depend on the features implemented in the current application.

### Student

The student accesses their own information and other permitted student services.

Potential responsibilities include:

- Viewing personal profile information.
- Browsing available courses.
- Viewing personal enrollment records.

Student-specific profile and enrollment pages must be implemented and enabled before these functions are considered available.

**Important:** The effective permission configuration determines actual access. Hiding a menu item in the frontend is not sufficient to protect a resource; the backend must independently authorize every protected operation.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Frontend tooling | Vite |
| Routing | React Router |
| HTTP client | Axios |
| Icons | Lucide React |
| Backend | Node.js |
| API framework | Express.js |
| Database | MongoDB |
| Database ODM | Mongoose |
| Input validation | Zod |
| Authentication | JSON Web Tokens (JWT) |
| Password security | bcrypt |
| Security middleware | Helmet |
| Cross-origin requests | CORS |
| Rate limiting | express-rate-limit |
| Environment variables | dotenv |
| Development server | Nodemon |

## System Architecture

The application follows a layered client-server architecture.

```text
+---------------------------------------+
|             Web Browser               |
|                                       |
|  React UI | Forms | Navigation        |
|  Protected Routes | Permission Checks |
+-------------------+-------------------+
                    |
                    | HTTP / JSON
                    | Bearer Token
                    v
+---------------------------------------+
|          Express.js REST API          |
|                                       |
|  Authentication Middleware            |
|  Authorization Middleware             |
|  Request Validation                   |
|  Controllers                          |
|  Business Services                    |
+-------------------+-------------------+
                    |
                    | Mongoose
                    v
+---------------------------------------+
|                MongoDB                |
|                                       |
|  Users | Students | Courses           |
|  Enrollments | Role Permissions        |
+---------------------------------------+
```

### Request processing

1. A user interacts with the React frontend.
2. Axios sends an HTTP request to the backend API.
3. Authentication middleware validates the user's credentials or token.
4. Authorization middleware verifies the required permission.
5. Validation and service logic process the request.
6. Mongoose reads or updates MongoDB.
7. The API returns a structured JSON response.
8. The frontend displays the result or an appropriate error message.

## Project Structure

The following structure represents the main application organization. Some files and optional modules may vary in your current implementation.

```text
student-management-mern/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── layout/
│   │   │   └── ui/
│   │   ├── contexts/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── students/
│   │   │   ├── courses/
│   │   │   ├── enrollments/
│   │   │   └── users/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── routes/
│   │   ├── styles/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
│
├── README.md
└── .gitignore
```

## Prerequisites

Install the following before running the application:

- Node.js and npm.
- MongoDB running locally or an accessible MongoDB deployment.
- Git, if cloning the repository.
- A modern web browser.
- A terminal or command-line interface.

Check the installed versions:

```bash
node --version
npm --version
mongosh --version
```

Use a Node.js version compatible with your installed dependencies.

## Installation and Setup

### 1. Obtain the project

If the project is already on your computer, navigate to its root directory:

```bash
cd ~/Desktop/Projects/student-management-mern
```

Alternatively, clone your repository:

```bash
git clone YOUR_REPOSITORY_URL
cd student-management-mern
```

Replace `YOUR_REPOSITORY_URL` with your actual repository URL.

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure the backend environment

Create a `.env` file in the `backend` directory using the variables required by your backend configuration.

Example:

```dotenv
NODE_ENV=development
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/student_management_mern
JWT_SECRET=replace_with_a_strong_random_secret
JWT_EXPIRES_IN=1d
```

These are example settings. Confirm the actual environment variable names in your backend configuration before using them.

Generate a strong secret rather than using the example placeholder.

### 4. Install frontend dependencies

Open another terminal:

```bash
cd ~/Desktop/Projects/student-management-mern/frontend
npm install
```

### 5. Configure the frontend environment

Create `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:5001/api
```

The frontend Axios client uses this variable to determine the API base URL.

Restart Vite whenever you change frontend environment variables.

### 6. Initialize the administrator account

Use the administrator seed or provisioning procedure already configured in your backend.

If no provisioning procedure exists, create a secure, restricted administrator setup process before attempting to use the application. Public user registration should not allow a user to assign themselves the administrator role.

## Running the Application

### Start the backend

Terminal 1:

```bash
cd ~/Desktop/Projects/student-management-mern/backend
npm run dev
```

Expected startup messages include:

```text
MongoDB connected successfully: student_management_mern
Student Management System API running on port 5001
```

### Start the frontend

Terminal 2:

```bash
cd ~/Desktop/Projects/student-management-mern/frontend
npm run dev
```

Vite will display the local frontend URL, typically:

```text
http://localhost:5173
```

### Verify the frontend build

```bash
cd ~/Desktop/Projects/student-management-mern/frontend
npm run build
```

A successful production build confirms that Vite can compile the frontend. It does not, by itself, verify all application functionality.

## Application Access

| Component | Development URL |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend API | `http://localhost:5001/api` |
| Health endpoint | `http://localhost:5001/api/health` |

The health endpoint URL assumes the health route is mounted at `/api/health` in your current backend.

Sign in using an administrator account created through the authorized provisioning procedure. Use the administrator interface to create separate instructor and student test accounts.

Do not commit test credentials, production credentials, or access tokens to the repository.

## API Overview

The backend exposes RESTful API endpoints for authentication and application operations.

### Authentication endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Authenticate a user |
| GET | `/api/auth/me` | Retrieve the current authenticated user's profile |

### User account endpoints

The following endpoints correspond to the user-account functionality implemented in the project.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/users` | Retrieve user accounts |
| POST | `/api/users` | Create a user account |
| PATCH | `/api/users/:id/status` | Update account status |

These user-account endpoints require appropriate authentication and administrator authorization in the described implementation.

Additional student, course, enrollment, dashboard, and role-permission endpoints depend on the routes currently registered in the backend. Consult the corresponding route files for their exact paths, methods, request bodies, and access requirements.

### Example: Login

Request:

```http
POST /api/auth/login
Content-Type: application/json
```

Example request body:

```json
{
  "email": "admin.test@example.com",
  "password": "YOUR_TEST_PASSWORD"
}
```

Example response shape:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "REDACTED_ACCESS_TOKEN",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "user": {
      "id": "USER_ID",
      "fullName": "Test Administrator",
      "email": "admin.test@example.com",
      "role": "admin"
    }
  }
}
```

This illustrates the login response structure. The actual response should be checked against the current implementation, including how effective permissions are supplied to the frontend.

### Example: Retrieve the current user

```bash
curl -i http://localhost:5001/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Replace the placeholder with a valid test token.

### API error handling

The frontend and backend should handle common outcomes, including:

- `400 Bad Request`: Invalid request data.
- `401 Unauthorized`: Missing or invalid authentication.
- `403 Forbidden`: Authenticated user lacks the required permission.
- `404 Not Found`: Requested resource does not exist.
- `409 Conflict`: Duplicate or conflicting data, where applicable.
- `500 Internal Server Error`: Unexpected server-side failure.

The exact status code depends on the endpoint's implemented error handling.

## Authentication and Authorization

The system separates authentication from authorization.

### Authentication

Authentication determines whether the user is logged in. The backend verifies credentials and issues a JWT access token.

### Authorization

Authorization determines what an authenticated user is permitted to do.

The system uses roles and effective permissions to control access to application features.

Examples of permission identifiers include:

```text
dashboard.read
students.read
courses.read
enrollments.read
users.read
role_permissions.read
```

The available permissions must match those defined in the current backend configuration.

### Frontend protection

The React frontend uses authentication state, protected routes, and permission-aware navigation to provide an appropriate user experience.

### Backend protection

The backend must independently verify the authenticated user and the required permission before executing a protected operation.

**Frontend menu visibility is not a substitute for backend authorization.**

## End-to-End Testing

Test the application using separate accounts for each actor.

### Administrator tests

- Log in and inspect the dashboard.
- Create instructor and student accounts.
- Create and update student records.
- Create and update courses.
- Manage enrollments.
- Change role permissions.
- Verify that account deactivation and permission changes affect access correctly.

### Instructor tests

- Log in using instructor credentials.
- Verify visible menus and accessible routes.
- Access authorized courses.
- View permitted student and enrollment information.
- Attempt to access unrelated records and administrator-only operations.

### Student tests

- Log in using student credentials.
- Verify the permitted navigation menu.
- Access own profile and enrollment information where implemented.
- Browse permitted courses.
- Attempt to access another student's private records.

### Security and validation tests

- Test incorrect credentials.
- Test missing or expired tokens.
- Test unauthorized direct URLs and API calls.
- Test duplicate emails, student numbers, and course codes.
- Test invalid input and missing required fields.
- Verify that logout clears the application's authentication state.

For a detailed testing procedure, maintain a separate end-to-end testing document with test IDs, preconditions, test steps, expected results, actual results, and evidence.

## Security Considerations

Before deploying the application to a production environment:

- Store secrets in environment variables or an appropriate secrets manager.
- Keep `.env` files out of version control.
- Use HTTPS in production.
- Enforce backend authentication and authorization for protected routes.
- Hash passwords using a secure password-hashing algorithm.
- Validate and normalize incoming data.
- Avoid exposing password hashes, tokens, and internal user fields in API responses.
- Configure CORS for trusted frontend origins.
- Apply rate limiting to sensitive endpoints such as login.
- Handle errors without exposing stack traces or secrets to clients.
- Ensure deactivated users cannot continue accessing protected resources.
- Review token storage and expiration strategy for the intended threat model.
- Restrict administrator account provisioning.
- Back up production data and test restoration procedures.

## Troubleshooting

### Backend cannot connect to MongoDB

Check that MongoDB is running and that `MONGODB_URI` is correct.

### Port 5001 is already in use

Identify the process using the port or configure the application to use an available port. Ensure the frontend API URL matches the backend port.

### Frontend cannot connect to the API

Verify `VITE_API_URL`, the backend startup logs, CORS configuration, and the browser Network tab.

### Sidebar menus are missing

Inspect the current user's effective permissions, the permission configuration in MongoDB, the `/api/auth/me` response, and the `usePermissions` hook.

### Login succeeds but protected pages fail

Verify that the token is attached to API requests, the authentication middleware accepts it, and the required permissions are present.

### Build fails

Run:

```bash
cd frontend
npm run build
```

Inspect the reported file path and error message. Resolve missing exports, incorrect imports, and syntax errors before retesting.

## Future Enhancements

Potential future enhancements include:

- Student self-service profile management.
- Instructor-course assignment workflows.
- Course capacity and waitlist management.
- Grade and attendance management.
- Notifications and announcements.
- Course materials and learning resources.
- Advanced reporting and analytics.
- Audit logs for administrative changes.
- Automated backend and frontend test suites.
- Continuous integration and deployment.
- Production monitoring and backup automation.

These are proposed enhancements, not claims that every feature is already implemented.

## License

Choose and add an appropriate license before distributing the project publicly. If the application is intended for institutional or educational use, confirm ownership and distribution requirements before selecting a license.

