import type { ServiceKey } from "@/lib/services";

export type ToolInfo = {
  slug: string;
  service?: ServiceKey; // no service means a tool that needs no login, like web search
  write: boolean;
  danger?: boolean;
  step: string;
  title?: string;
  running?: string;
  done?: string;
};

export const tools: ToolInfo[] = [
  // Calendar
  { slug: "GOOGLECALENDAR_EVENTS_LIST", service: "calendar", write: false, step: "Checking your calendar" },
  { slug: "GOOGLECALENDAR_FIND_FREE_SLOTS", service: "calendar", write: false, step: "Looking for free time" },
  { slug: "GOOGLECALENDAR_CREATE_EVENT", service: "calendar", write: true, step: "Preparing the event", title: "Add event", running: "Adding the event", done: "Done. The event is on your calendar." },
  { slug: "GOOGLECALENDAR_PATCH_EVENT", service: "calendar", write: true, step: "Preparing the change", title: "Change event", running: "Updating the event", done: "Done. The event is updated." },
  { slug: "GOOGLECALENDAR_DELETE_EVENT", service: "calendar", write: true, danger: true, step: "Preparing to remove the event", title: "Delete event", running: "Deleting the event", done: "Done. The event is deleted." },
  // Tasks
  { slug: "GOOGLETASKS_LIST_TASK_LISTS", service: "tasks", write: false, step: "Looking at your task lists" },
  { slug: "GOOGLETASKS_LIST_ALL_TASKS", service: "tasks", write: false, step: "Checking your tasks" },
  { slug: "GOOGLETASKS_INSERT_TASK", service: "tasks", write: true, step: "Preparing the task", title: "Add task", running: "Adding the task", done: "Done. The task is in Google Tasks." },
  { slug: "GOOGLETASKS_PATCH_TASK", service: "tasks", write: true, step: "Preparing the change", title: "Update task", running: "Updating the task", done: "Done. The task is updated." },
  { slug: "GOOGLETASKS_DELETE_TASK", service: "tasks", write: true, danger: true, step: "Preparing to remove the task", title: "Delete task", running: "Deleting the task", done: "Done. The task is deleted." },
  // Gmail
  { slug: "GMAIL_FETCH_EMAILS", service: "gmail", write: false, step: "Searching your email" },
  { slug: "GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID", service: "gmail", write: false, step: "Reading the email" },
  { slug: "GMAIL_SEND_EMAIL", service: "gmail", write: true, step: "Drafting the email", title: "Send email", running: "Sending the email", done: "Done. The email was sent." },
  { slug: "GMAIL_REPLY_TO_THREAD", service: "gmail", write: true, step: "Drafting the reply", title: "Send reply", running: "Sending the reply", done: "Done. The reply was sent." },
  { slug: "GMAIL_CREATE_EMAIL_DRAFT", service: "gmail", write: true, step: "Drafting the email", title: "Save draft", running: "Saving the draft", done: "Done. The draft is in your Gmail Drafts." },
  // Drive
  { slug: "GOOGLEDRIVE_FIND_FILE", service: "drive", write: false, step: "Searching your Drive" },
  { slug: "GOOGLEDRIVE_GET_FILE_METADATA", service: "drive", write: false, step: "Looking at the file" },
  { slug: "GOOGLEDRIVE_GET_DOCUMENT", service: "drive", write: false, step: "Reading the document" },
  { slug: "GOOGLEDRIVE_CREATE_FILE_FROM_TEXT", service: "drive", write: true, step: "Preparing the file", title: "Create file", running: "Creating the file", done: "Done. The file is in your Drive." },
];

// Web search needs no account. These only read, so they run without asking.
export const webTools: ToolInfo[] = [
  { slug: "COMPOSIO_SEARCH_DUCK_DUCK_GO_SEARCH", write: false, step: "Searching the web" },
  { slug: "COMPOSIO_SEARCH_NEWS_SEARCH", write: false, step: "Checking the news" },
  { slug: "COMPOSIO_SEARCH_FINANCE_SEARCH", write: false, step: "Checking market data" },
  { slug: "COMPOSIO_SEARCH_FETCH_URL_CONTENT", write: false, step: "Reading the page" },
];

export const bySlug: Record<string, ToolInfo> = Object.fromEntries([...tools, ...webTools].map((t) => [t.slug, t]));