/**
 * Static, local-only data for the Portal design prototype.  It intentionally
 * has no API/auth dependency so every portal route can render in isolation.
 */

export type PortalRole = "student" | "educator";

export type PortalRouteKey =
  | "home"
  | "learn"
  | "course"
  | "lesson"
  | "live"
  | "live-class"
  | "recordings"
  | "practice"
  | "test"
  | "results"
  | "doubts"
  | "inbox"
  | "profile"
  | "downloads"
  | "offline"
  | "educator-home"
  | "educator-classes"
  | "educator-class"
  | "educator-courses"
  | "educator-learners"
  | "educator-doubts"
  | "educator-insights"
  | "educator-profile";

export type SubjectId = "physics" | "chemistry" | "mathematics" | "biology";

export type PortalIconName =
  | "house"
  | "book-open"
  | "radio"
  | "clipboard-check"
  | "user-round"
  | "calendar-days"
  | "graduation-cap"
  | "message-circle"
  | "bell"
  | "download"
  | "chart-no-axes-combined";

export interface PortalNavItem {
  label: string;
  href: string;
  icon: PortalIconName;
  route: PortalRouteKey;
  badge?: string;
}

export interface PortalRouteDefinition {
  key: PortalRouteKey;
  title: string;
  role: PortalRole | "shared";
  pattern: string;
  description: string;
}

export interface Subject {
  id: SubjectId;
  label: string;
  shortLabel: string;
  color: string;
  softColor: string;
  icon: string;
}

export interface Course {
  id: string;
  title: string;
  subjectId: SubjectId;
  educatorName: string;
  educatorInitials: string;
  accent: string;
  cover: "orbit" | "molecules" | "formula" | "cells";
  progress: number;
  completedLessons: number;
  lessonCount: number;
  duration: string;
  nextLessonId: string;
  nextLessonTitle: string;
  enrollmentLabel: string;
  description: string;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  section: string;
  duration: string;
  kind: "video" | "reading" | "worksheet" | "quiz";
  completed: boolean;
  locked?: boolean;
  progress?: number;
  thumbnail: "wave" | "atom" | "equation" | "diagram";
}

export interface LiveClass {
  id: string;
  title: string;
  subjectId: SubjectId;
  educatorName: string;
  educatorInitials: string;
  startsAt: string;
  duration: string;
  status: "live" | "upcoming" | "recorded";
  attendees: number;
  goal: string;
  roomLabel: string;
  dateLabel: string;
}

export interface PracticeSet {
  id: string;
  title: string;
  subjectId: SubjectId;
  questionCount: number;
  duration: string;
  difficulty: "Starter" | "Build" | "Challenge";
  completion: number;
  dueLabel: string;
}

export interface TestResult {
  id: string;
  title: string;
  subjectId: SubjectId;
  score: number;
  total: number;
  percentile: number;
  dateLabel: string;
  improvement: string;
  focusTopic: string;
}

export interface Doubt {
  id: string;
  title: string;
  body: string;
  subjectId: SubjectId;
  author: string;
  authorInitials: string;
  status: "answered" | "open" | "follow-up";
  replyCount: number;
  timeLabel: string;
  acceptedAnswer?: string;
}

export interface Notification {
  id: string;
  type: "live" | "result" | "doubt" | "download" | "reminder";
  title: string;
  body: string;
  timeLabel: string;
  unread: boolean;
}

export interface Learner {
  id: string;
  name: string;
  initials: string;
  streak: number;
  attendance: number;
  progress: number;
  confidence: "On track" | "Needs a nudge" | "At risk";
  lastActive: string;
}

export interface DemoMessage {
  id: string;
  author: string;
  initials: string;
  body: string;
  timeLabel: string;
  mine?: boolean;
  kind?: "chat" | "question" | "poll";
}

export const subjects: readonly Subject[] = [
  { id: "physics", label: "Physics", shortLabel: "PHY", color: "#675CFF", softColor: "#EEEFFF", icon: "⚛" },
  { id: "chemistry", label: "Chemistry", shortLabel: "CHE", color: "#F16C5B", softColor: "#FFF0EB", icon: "◒" },
  { id: "mathematics", label: "Mathematics", shortLabel: "MATH", color: "#188B75", softColor: "#E8F7F1", icon: "∑" },
  { id: "biology", label: "Biology", shortLabel: "BIO", color: "#D69627", softColor: "#FFF6DE", icon: "✣" },
] as const;

export const studentNavigation: readonly PortalNavItem[] = [
  { label: "Home", href: "/portal", icon: "house", route: "home" },
  { label: "Learn", href: "/portal/learn", icon: "book-open", route: "learn" },
  { label: "Live", href: "/portal/live", icon: "radio", route: "live", badge: "LIVE" },
  { label: "Practice", href: "/portal/practice", icon: "clipboard-check", route: "practice" },
  { label: "You", href: "/portal/profile", icon: "user-round", route: "profile" },
] as const;

export const educatorNavigation: readonly PortalNavItem[] = [
  { label: "Today", href: "/portal/educator", icon: "house", route: "educator-home" },
  { label: "Classes", href: "/portal/educator/classes", icon: "calendar-days", route: "educator-classes" },
  { label: "Courses", href: "/portal/educator/courses", icon: "book-open", route: "educator-courses" },
  { label: "Learners", href: "/portal/educator/learners", icon: "graduation-cap", route: "educator-learners" },
  { label: "Insights", href: "/portal/educator/insights", icon: "chart-no-axes-combined", route: "educator-insights" },
] as const;

export const portalRoutes: readonly PortalRouteDefinition[] = [
  { key: "home", title: "Home", role: "student", pattern: "/portal", description: "Student daily study dashboard" },
  { key: "learn", title: "Learn", role: "student", pattern: "/portal/learn", description: "Course library" },
  { key: "course", title: "Course", role: "student", pattern: "/portal/learn/[courseId]", description: "Course roadmap and lessons" },
  { key: "lesson", title: "Lesson", role: "student", pattern: "/portal/learn/[courseId]/lessons/[lessonId]", description: "Lesson player and notes" },
  { key: "live", title: "Live schedule", role: "student", pattern: "/portal/live", description: "Upcoming and recorded classes" },
  { key: "live-class", title: "Live class", role: "shared", pattern: "/portal/live/[classId]", description: "Live class cockpit" },
  { key: "recordings", title: "Recordings", role: "student", pattern: "/portal/recordings", description: "Class replay library" },
  { key: "practice", title: "Practice", role: "student", pattern: "/portal/practice", description: "Practice set library" },
  { key: "test", title: "Test", role: "student", pattern: "/portal/practice/[testId]", description: "Focused test canvas" },
  { key: "results", title: "Results", role: "student", pattern: "/portal/results", description: "Performance and revision guidance" },
  { key: "doubts", title: "Doubts", role: "student", pattern: "/portal/doubts", description: "Question and answer rooms" },
  { key: "inbox", title: "Inbox", role: "student", pattern: "/portal/inbox", description: "Notifications and class messages" },
  { key: "profile", title: "Your profile", role: "student", pattern: "/portal/profile", description: "Student profile and settings" },
  { key: "downloads", title: "Downloads", role: "student", pattern: "/portal/downloads", description: "Offline course materials" },
  { key: "offline", title: "Offline", role: "shared", pattern: "/portal/offline", description: "Connection recovery" },
  { key: "educator-home", title: "Educator dashboard", role: "educator", pattern: "/portal/educator", description: "Teaching agenda" },
  { key: "educator-classes", title: "Classes", role: "educator", pattern: "/portal/educator/classes", description: "Class schedule and recordings" },
  { key: "educator-class", title: "Class control room", role: "educator", pattern: "/portal/educator/classes/[classId]", description: "Educator live class controls" },
  { key: "educator-courses", title: "Course studio", role: "educator", pattern: "/portal/educator/courses", description: "Course and lesson publishing" },
  { key: "educator-learners", title: "Learners", role: "educator", pattern: "/portal/educator/learners", description: "Roster and attendance" },
  { key: "educator-doubts", title: "Doubts", role: "educator", pattern: "/portal/educator/doubts", description: "Educator doubt queue" },
  { key: "educator-insights", title: "Insights", role: "educator", pattern: "/portal/educator/insights", description: "Class performance overview" },
  { key: "educator-profile", title: "Educator settings", role: "educator", pattern: "/portal/educator/profile", description: "Educator profile and teaching preferences" },
] as const;

export const courses: readonly Course[] = [
  {
    id: "physics-motion",
    title: "Motion, Forces & Energy",
    subjectId: "physics",
    educatorName: "Aarav Mehta",
    educatorInitials: "AM",
    accent: "#675CFF",
    cover: "orbit",
    progress: 68,
    completedLessons: 17,
    lessonCount: 25,
    duration: "18h 40m",
    nextLessonId: "relative-motion",
    nextLessonTitle: "Relative motion: reading the frame",
    enrollmentLabel: "Class 11 · Foundation",
    description: "Build intuition for mechanics with visual explanations, drills, and live problem-solving.",
  },
  {
    id: "chemistry-bonds",
    title: "Chemical Bonding, Clearly",
    subjectId: "chemistry",
    educatorName: "Maya Iyer",
    educatorInitials: "MI",
    accent: "#F16C5B",
    cover: "molecules",
    progress: 42,
    completedLessons: 8,
    lessonCount: 19,
    duration: "13h 15m",
    nextLessonId: "hybridisation",
    nextLessonTitle: "Hybridisation without memorising",
    enrollmentLabel: "Class 11 · Core",
    description: "Make atoms, bonds, and structures feel predictable instead of dense.",
  },
  {
    id: "math-functions",
    title: "Functions & Graph Thinking",
    subjectId: "mathematics",
    educatorName: "Karan Rao",
    educatorInitials: "KR",
    accent: "#188B75",
    cover: "formula",
    progress: 24,
    completedLessons: 5,
    lessonCount: 21,
    duration: "16h 05m",
    nextLessonId: "transformations",
    nextLessonTitle: "Transformations at a glance",
    enrollmentLabel: "Class 11 · Foundation",
    description: "A visual route through graphs, domains, transformations, and problem sets.",
  },
  {
    id: "bio-human-systems",
    title: "Human Systems Lab",
    subjectId: "biology",
    educatorName: "Nisha Sen",
    educatorInitials: "NS",
    accent: "#D69627",
    cover: "cells",
    progress: 0,
    completedLessons: 0,
    lessonCount: 16,
    duration: "11h 20m",
    nextLessonId: "circulation",
    nextLessonTitle: "The circulation map",
    enrollmentLabel: "Class 11 · Enrolled",
    description: "Understand systems through diagrams, memory hooks, and compact recaps.",
  },
] as const;

export const lessons: readonly Lesson[] = [
  { id: "vectors-recap", courseId: "physics-motion", title: "Vector recap in 12 minutes", section: "Motion foundations", duration: "12 min", kind: "video", completed: true, thumbnail: "wave" },
  { id: "relative-motion", courseId: "physics-motion", title: "Relative motion: reading the frame", section: "Motion foundations", duration: "24 min", kind: "video", completed: false, progress: 38, thumbnail: "wave" },
  { id: "boat-river", courseId: "physics-motion", title: "Boat and river practice", section: "Motion foundations", duration: "10 Qs", kind: "quiz", completed: false, thumbnail: "diagram" },
  { id: "newton-laws", courseId: "physics-motion", title: "Newton's laws with free-body diagrams", section: "Force systems", duration: "29 min", kind: "video", completed: false, thumbnail: "diagram" },
  { id: "hybridisation", courseId: "chemistry-bonds", title: "Hybridisation without memorising", section: "Molecular shape", duration: "21 min", kind: "video", completed: false, progress: 12, thumbnail: "atom" },
  { id: "vsepr-drill", courseId: "chemistry-bonds", title: "VSEPR quick drill", section: "Molecular shape", duration: "14 Qs", kind: "quiz", completed: false, thumbnail: "atom" },
  { id: "transformations", courseId: "math-functions", title: "Transformations at a glance", section: "Function families", duration: "18 min", kind: "video", completed: false, thumbnail: "equation" },
  { id: "domain-range", courseId: "math-functions", title: "Domain and range worksheet", section: "Function families", duration: "8 min", kind: "worksheet", completed: false, thumbnail: "equation" },
] as const;

export const liveClasses: readonly LiveClass[] = [
  { id: "live-relative-motion", title: "Relative motion: live problem lab", subjectId: "physics", educatorName: "Aarav Mehta", educatorInitials: "AM", startsAt: "Starts in 18 min", duration: "60 min", status: "live", attendees: 128, goal: "Use frames of reference to solve two-body motion questions.", roomLabel: "Physics live room", dateLabel: "Today · 6:30 PM" },
  { id: "live-bond-shapes", title: "Molecular shapes, from first principles", subjectId: "chemistry", educatorName: "Maya Iyer", educatorInitials: "MI", startsAt: "Tomorrow · 5:00 PM", duration: "45 min", status: "upcoming", attendees: 94, goal: "Predict molecular shape from electron-pair repulsion.", roomLabel: "Chemistry live room", dateLabel: "Tomorrow · 5:00 PM" },
  { id: "live-functions-recap", title: "Function transformations recap", subjectId: "mathematics", educatorName: "Karan Rao", educatorInitials: "KR", startsAt: "Recorded", duration: "52 min", status: "recorded", attendees: 116, goal: "Turn a base graph into any transformation with confidence.", roomLabel: "Math replay room", dateLabel: "Monday · 6:00 PM" },
] as const;

export const practiceSets: readonly PracticeSet[] = [
  { id: "motion-mixed-01", title: "Motion mixed set 01", subjectId: "physics", questionCount: 15, duration: "20 min", difficulty: "Build", completion: 0, dueLabel: "Due tonight" },
  { id: "bonding-speed", title: "Chemical bonding speed run", subjectId: "chemistry", questionCount: 10, duration: "12 min", difficulty: "Starter", completion: 60, dueLabel: "Continue anytime" },
  { id: "functions-challenge", title: "Functions challenge", subjectId: "mathematics", questionCount: 20, duration: "30 min", difficulty: "Challenge", completion: 0, dueLabel: "New this week" },
] as const;

export const testResults: readonly TestResult[] = [
  { id: "mechanics-weekly", title: "Mechanics weekly check", subjectId: "physics", score: 36, total: 45, percentile: 82, dateLabel: "Yesterday", improvement: "+9% from last week", focusTopic: "Revise relative velocity signs" },
  { id: "chemistry-unit", title: "Chemical bonding unit test", subjectId: "chemistry", score: 28, total: 40, percentile: 69, dateLabel: "12 Jul", improvement: "+5% from last attempt", focusTopic: "Practice molecular geometry" },
  { id: "math-functions", title: "Functions checkpoint", subjectId: "mathematics", score: 31, total: 40, percentile: 75, dateLabel: "07 Jul", improvement: "Steady performance", focusTopic: "Review inverse functions" },
] as const;

export const doubts: readonly Doubt[] = [
  { id: "doubt-relative-frame", title: "Why does the relative velocity sign change here?", body: "I understand the formula, but why do we subtract in this direction?", subjectId: "physics", author: "You", authorInitials: "AY", status: "answered", replyCount: 3, timeLabel: "12 min ago", acceptedAnswer: "Choose one object as your frame. Every velocity is then measured relative to that chosen frame." },
  { id: "doubt-hybridisation", title: "Is sp3 always tetrahedral?", body: "Can a molecule with sp3 hybridisation have a different visible shape?", subjectId: "chemistry", author: "Riya", authorInitials: "RS", status: "open", replyCount: 1, timeLabel: "28 min ago" },
  { id: "doubt-domain", title: "Quick way to find domain after a transformation?", body: "I keep making errors when the graph moves left or right.", subjectId: "mathematics", author: "Dev", authorInitials: "DK", status: "follow-up", replyCount: 4, timeLabel: "1 hr ago" },
] as const;

export const notifications: readonly Notification[] = [
  { id: "notification-live", type: "live", title: "Relative motion lab begins soon", body: "Aarav's live class starts in 18 minutes. Your worksheet is ready.", timeLabel: "Now", unread: true },
  { id: "notification-result", type: "result", title: "Your mechanics result is in", body: "You reached the 82nd percentile. See your revision path.", timeLabel: "45 min", unread: true },
  { id: "notification-doubt", type: "doubt", title: "Your doubt was answered", body: "Aarav explained the reference-frame sign change.", timeLabel: "2 hr", unread: false },
  { id: "notification-download", type: "download", title: "Class replay downloaded", body: "Function transformations is available offline.", timeLabel: "Yesterday", unread: false },
] as const;

export const learners: readonly Learner[] = [
  { id: "aanya", name: "Aanya Yadav", initials: "AY", streak: 12, attendance: 96, progress: 68, confidence: "On track", lastActive: "Now" },
  { id: "riya", name: "Riya Sharma", initials: "RS", streak: 5, attendance: 88, progress: 54, confidence: "Needs a nudge", lastActive: "18 min ago" },
  { id: "dev", name: "Dev Kumar", initials: "DK", streak: 2, attendance: 71, progress: 32, confidence: "At risk", lastActive: "Yesterday" },
  { id: "kabir", name: "Kabir Jain", initials: "KJ", streak: 9, attendance: 92, progress: 61, confidence: "On track", lastActive: "4 min ago" },
] as const;

export const liveMessages: readonly DemoMessage[] = [
  { id: "message-1", author: "Maya", initials: "MI", body: "Can everyone see the velocity diagram?", timeLabel: "6:34 PM", kind: "chat" },
  { id: "message-2", author: "You", initials: "AY", body: "Yes, but could you repeat the last sign convention?", timeLabel: "6:35 PM", mine: true, kind: "chat" },
  { id: "message-3", author: "Aarav", initials: "AM", body: "Poll: which frame makes the river speed zero?", timeLabel: "6:36 PM", kind: "poll" },
] as const;

export const portalDemoData = {
  student: {
    name: "Aanya Yadav",
    initials: "AY",
    classLabel: "Class 11 · Science",
    streak: 12,
    weeklyMinutes: 386,
    weeklyGoalMinutes: 480,
    todayGoalLabel: "2 of 3 study blocks complete",
  },
  educator: {
    name: "Aarav Mehta",
    initials: "AM",
    roleLabel: "Physics educator",
    nextClassLabel: "Relative motion lab · 6:30 PM",
  },
  subjects,
  courses,
  lessons,
  liveClasses,
  practiceSets,
  testResults,
  doubts,
  notifications,
  learners,
  liveMessages,
  studentNavigation,
  educatorNavigation,
} as const;

export function getSubject(subjectId: SubjectId): Subject {
  return subjects.find((subject) => subject.id === subjectId) ?? subjects[0];
}

export function getCourse(courseId?: string): Course {
  return courses.find((course) => course.id === courseId) ?? courses[0];
}

export function getLesson(lessonId?: string): Lesson {
  return lessons.find((lesson) => lesson.id === lessonId) ?? lessons[1];
}

export function getLiveClass(classId?: string): LiveClass {
  return liveClasses.find((liveClass) => liveClass.id === classId) ?? liveClasses[0];
}

/** Resolve a URL segment sequence to one of the presentation screens. */
export function getPortalRoute(segments: readonly string[]): PortalRouteKey {
  if (segments.length === 0) return "home";

  const [first, second, third] = segments;
  if (first === "learn" && second && third === "lessons") return "lesson";
  if (first === "learn" && second) return "course";
  if (first === "learn") return "learn";
  if (first === "live" && second) return "live-class";
  if (first === "live") return "live";
  if (first === "recordings") return "recordings";
  if (first === "practice" && second) return "test";
  if (first === "practice") return "practice";
  if (first === "results") return "results";
  if (first === "doubts") return "doubts";
  if (first === "inbox") return "inbox";
  if (first === "profile") return "profile";
  if (first === "downloads") return "downloads";
  if (first === "offline") return "offline";

  if (first === "educator" && !second) return "educator-home";
  if (first === "educator" && second === "classes" && third) return "educator-class";
  if (first === "educator" && second === "classes") return "educator-classes";
  if (first === "educator" && second === "courses") return "educator-courses";
  if (first === "educator" && second === "learners") return "educator-learners";
  if (first === "educator" && second === "doubts") return "educator-doubts";
  if (first === "educator" && second === "insights") return "educator-insights";
  if (first === "educator" && second === "profile") return "educator-profile";

  return "home";
}

export function getPortalRouteTitle(segments: readonly string[]): string {
  const route = getPortalRoute(segments);
  return portalRoutes.find((definition) => definition.key === route)?.title ?? "Study portal";
}
