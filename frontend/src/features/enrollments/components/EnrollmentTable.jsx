import EnrollmentStatusBadge from "./EnrollmentStatusBadge";

function getId(item) {
  return item?._id ?? item?.id;
}

function studentName(student) {
  if (typeof student === "string") return student;
  if (student?.fullName) return student.fullName;
  const parts = [student?.firstName, student?.lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (student?.name) return student.name;
  if (student?.email) return student.email;
  return "Unknown student";
}

function courseName(course) {
  if (typeof course === "string") return course;
  return (
    [course?.courseCode, course?.title].filter(Boolean).join(" — ") ||
    "Unknown course"
  );
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * @param {object} props
 * @param {Array} props.enrollments
 * @param {function} props.onCancelEnrollment
 * @param {string|null} props.cancellingId
 * @param {boolean} [props.canManage]  — permission gate; hides the
 *   cancel button entirely if the user lacks `enrollments.cancel`.
 * @param {string} [props.label]
 */
export default function EnrollmentTable({
  enrollments = [],
  onCancelEnrollment,
  cancellingId = null,
  canManage = false, // ✅ NEW: permission gate
  label = "Enrollments",
}) {
  if (enrollments.length === 0) {
    return (
      <div className="enrollment-state">
        <h3>No enrollments found</h3>
        <p>
          Try adjusting the filters, or create an enrollment to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="enrollment-table-scroll">
      <table className="enrollment-table" aria-label={label}>
        <thead>
          <tr>
            <th scope="col">Student</th>
            <th scope="col">Course</th>
            <th scope="col">Enrollment date</th>
            <th scope="col">Status</th>
            <th scope="col">Cancelled at</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((enrollment) => {
            const id = getId(enrollment);
            const status = String(enrollment.status ?? "unknown").toLowerCase();

            // ✅ Two conditions: user has the permission AND this row
            // is in a cancellable state (status === "enrolled").
            const canCancel = canManage && status === "enrolled";

            return (
              <tr key={id}>
                <td>
                  <div className="enrollment-cell-primary">
                    <strong>{studentName(enrollment.student)}</strong>
                    {enrollment.student?.studentId && (
                      <small>{enrollment.student.studentId}</small>
                    )}
                  </div>
                </td>
                <td>
                  <div className="enrollment-cell-primary">
                    <strong>{courseName(enrollment.course)}</strong>
                    {enrollment.course?.department && (
                      <small>{enrollment.course.department}</small>
                    )}
                  </div>
                </td>
                <td>
                  {formatDate(
                    enrollment.enrolledAt ??
                      enrollment.enrollmentDate ??
                      enrollment.createdAt,
                  )}
                </td>
                <td>
                  <EnrollmentStatusBadge status={status} />
                </td>
                <td>
                  {status === "cancelled"
                    ? formatDate(
                        enrollment.cancelledAt ?? enrollment.cancellationDate,
                      )
                    : "—"}
                </td>
                <td>
                  {canCancel && (
                    <button
                      type="button"
                      className="enrollment-action"
                      disabled={cancellingId === id}
                      aria-busy={cancellingId === id}
                      onClick={() => onCancelEnrollment(enrollment)}
                      aria-label={`Cancel enrollment for ${studentName(enrollment.student)}`}
                    >
                      {cancellingId === id
                        ? "Cancelling..."
                        : "Cancel enrollment"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
