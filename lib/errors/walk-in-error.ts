type WalkInError = { code?: string; message?: string };

/** Translate only exact, known database failures; never expose SQL or record data. */
export function walkInErrorMessage(error: WalkInError) {
  if (error.code === "PGRST202" || error.code === "42883") {
    return "Walk-in entry is temporarily unavailable. Ask your workspace administrator to update the system, then try again.";
  }
  if (error.code === "42501") return "You do not have access to add walk-ins at this branch. Select an allowed branch or contact your administrator.";
  if (error.code === "23505") return "This selection was already added. Check the queue before trying again.";
  if (error.code === "P0001") {
    switch (error.message) {
      case "Service is unavailable at this branch":
        return "A selected service is unavailable at this branch. Choose another service or change the branch.";
      case "Appointment service is unavailable":
      case "Appointment/service organization mismatch":
        return "A selected service is no longer available. Remove it and choose an active service.";
      case "Appointment vehicle/customer mismatch":
      case "Queue organization mismatch":
        return "The vehicle does not match this customer. Select the customer's vehicle and try again.";
      case "Appointment organization mismatch":
        return "The customer or vehicle is no longer available in this workspace. Select them again.";
      case "Select at least one service":
        return "Select at least one service.";
      case "A vehicle is required to enter the automotive queue":
        return "Select a vehicle belonging to this customer.";
    }
  }
  return "Unable to add this walk-in. Your entries have been kept. Try again, or contact your administrator if the problem continues.";
}
