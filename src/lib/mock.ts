// Sample data for the guide build. Replaced by real data in the steps listed in the README.
export type MockEvent = {
  id: string;
  time: string;
  title: string;
  place: string;
};

export const mockEvents: MockEvent[] = [
  { id: "e1", time: "10:00 AM to 11:30 AM", title: "Biochemistry seminar", place: "Room 104, Sciences Building" },
  { id: "e2", time: "2:00 PM to 3:30 PM", title: "ENG 302: Thermodynamics lecture", place: "Faculty Hall 3" },
];

export type MockTask = { id: string; title: string; due: string; done: boolean };

export const mockTasks: MockTask[] = [
  { id: "t1", title: "Review Chapter 4 problem set", due: "Due 1:00 PM", done: false },
  { id: "t2", title: "Submit lab group worksheet", due: "Due 5:00 PM", done: false },
  { id: "t3", title: "Pick up course syllabus from the department office", due: "Done at 8:45 AM", done: true },
];

export type MockEmail = { id: string; from: string; time: string; subject: string; summary: string };

export const mockEmails: MockEmail[] = [
  {
    id: "m1",
    from: "Dr. K. Adeyemi",
    time: "8:12 AM",
    subject: "Update on Friday tutorial schedule",
    summary: "The tutorial moved from 10:00 AM to 11:30 AM because of a faculty meeting.",
  },
  {
    id: "m2",
    from: "University Library",
    time: "Yesterday",
    subject: "Books due in 2 days",
    summary: "Two loans are due on October 26.",
  },
];

export type MockConversation = {
  id: string;
  group: "Today" | "Yesterday" | "Earlier this week";
  title: string;
  preview: string;
  time: string;
  tag: string;
};

export const mockConversations: MockConversation[] = [
  { id: "c1", group: "Today", title: "Friday schedule and study reminder", preview: "Checked your calendar and added a reminder before the 3 PM chemistry lab.", time: "1:14 PM", tag: "Calendar and Tasks" },
  { id: "c2", group: "Today", title: "Biochemistry seminar notes lookup", preview: "Found the slide on oxidative phosphorylation in Google Drive.", time: "9:30 AM", tag: "Drive" },
  { id: "c3", group: "Yesterday", title: "ENG 302 lecture slide summary", preview: "Pulled the key points on stress and fatigue life from the lecture PDF.", time: "4:45 PM", tag: "Drive" },
  { id: "c4", group: "Yesterday", title: "Emails from Dr. Adeyemi", preview: "Two messages about the tutorial time change.", time: "2:10 PM", tag: "Gmail" },
  { id: "c5", group: "Earlier this week", title: "Library book due dates", preview: "Added a reminder to return two physics textbooks before 5 PM.", time: "Monday", tag: "Tasks" },
];
