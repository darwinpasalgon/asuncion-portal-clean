type DatabaseError = { code?: string; message?: string };

// Only known, actionable messages reach the browser. Database details can
// contain learner/account data and must not be returned verbatim.
export function teachingAssignmentError(error: DatabaseError, subject: string, major: string | null) {
  const label = major ? `${subject} (${major})` : subject;
  const message = String(error?.message ?? "").toLowerCase();
  let reason = "Please refresh the page and try again. If this continues, contact the Administrator.";
  let status = 400;

  if (error?.code === "23514" && message.includes("teacher_assignments_major_check")) {
    reason = "The selected TVE Major is not accepted by the current school setup. Please ask the Administrator to check the TVE Major list.";
  } else if (error?.code === "23505") {
    reason = "An assignment already exists for this subject and major. Refresh the page before changing its teacher.";
    status = 409;
  } else if (message.includes("teacher must be an active teacher account")) {
    reason = "The selected teacher needs an active Teacher account before they can be assigned.";
  } else if (message.includes("section must be active")) {
    reason = "The section must be active and match the selected Grade Level.";
  } else if (message.includes("subject must be active")) {
    reason = "The subject must be active and match the selected Grade Level.";
  } else if (error?.code === "42501") {
    reason = "Your account does not have permission to save this assignment. Ask an Administrator to check your Teaching Setup access.";
    status = 403;
  } else if (error?.code === "PGRST301" || error?.code === "PGRST303") {
    reason = "Your session has expired. Refresh the page to reconnect, then try again.";
    status = 401;
  }

  return { error: `Unable to save ${label}. ${reason}`, status };
}
