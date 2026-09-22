export type ServiceKey = "calendar" | "tasks" | "gmail" | "drive";

export type Service = {
  key: ServiceKey;
  name: string;
  blurb: string;
  can: string[];
  cannot: string[];
  openLabel: string;
};

export const serviceOrder: ServiceKey[] = ["calendar", "tasks", "gmail", "drive"];

export const services: Record<ServiceKey, Service> = {
  calendar: {
    key: "calendar",
    name: "Google Calendar",
    blurb: "Reads upcoming events, adds new ones and checks when you are free.",
    can: [
      "View your upcoming events and their details",
      "Add and edit events when you ask",
      "Check when you are free",
    ],
    cannot: [
      "Delete or change an event without your confirmation",
      "Share your calendar with anyone",
    ],
    openLabel: "Open in Google Calendar",
  },
  tasks: {
    key: "tasks",
    name: "Google Tasks",
    blurb: "Adds reminders, lists your tasks and marks them done.",
    can: [
      "List your task lists and tasks",
      "Create and update tasks when you ask",
      "Mark tasks as done",
    ],
    cannot: ["Delete a task list", "Share your tasks with anyone"],
    openLabel: "Open in Google Tasks",
  },
  gmail: {
    key: "gmail",
    name: "Gmail",
    blurb: "Finds and summarizes messages when you ask about them.",
    can: [
      "Search your mail",
      "Read messages you ask about",
      "Summarize threads and pull out what needs action",
    ],
    cannot: [
      "Send email (not available yet)",
      "Delete or archive email",
      "Read mail you did not ask about",
    ],
    openLabel: "Open in Gmail",
  },
  drive: {
    key: "drive",
    name: "Google Drive",
    blurb: "Finds files, lecture notes and documents by name or topic.",
    can: ["Search your files", "Read the files you ask about"],
    cannot: ["Edit, move or delete files", "Share files with anyone"],
    openLabel: "Open in Google Drive",
  },
};
