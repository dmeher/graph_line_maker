"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Download,
  FileText,
  Flame,
  GraduationCap,
  Grid2X2,
  Hand,
  Headphones,
  Home,
  Layers3,
  Lightbulb,
  LockKeyhole,
  Menu,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  Send,
  Settings2,
  Sparkles,
  TimerReset,
  Trophy,
  Upload,
  UserRound,
  UsersRound,
  Video,
  Volume2,
  Wifi,
  X,
  Zap,
  type LucideProps,
} from "lucide-react";
import {
  courses,
  doubts,
  educatorNavigation,
  getCourse,
  getLesson,
  getLiveClass,
  getPortalRoute,
  getPortalRouteTitle,
  getSubject,
  learners,
  lessons,
  liveClasses,
  liveMessages,
  notifications,
  portalDemoData,
  practiceSets,
  studentNavigation,
  subjects,
  testResults,
  type Course,
  type LiveClass,
  type PortalIconName,
  type PortalNavItem,
  type PortalRouteKey,
  type SubjectId,
} from "@/lib/portal/demo-data";

type PortalTheme = "pulse" | "atlas";
type LiveSheet = "chat" | "questions" | "poll" | "materials" | "roster" | null;

interface PortalClientProps {
  pathname: string;
  segments: readonly string[];
}

const navIcons: Record<PortalIconName, LucideIcon> = {
  house: Home,
  "book-open": BookOpen,
  radio: Radio,
  "clipboard-check": ClipboardCheck,
  "user-round": UserRound,
  "calendar-days": CalendarDays,
  "graduation-cap": GraduationCap,
  "message-circle": MessageCircle,
  bell: Bell,
  download: Download,
  "chart-no-axes-combined": Sparkles,
};

const subjectIcon: Record<SubjectId, LucideIcon> = {
  physics: Zap,
  chemistry: Sparkles,
  mathematics: Grid2X2,
  biology: Lightbulb,
};

function Icon({ icon: IconComponent, size = 18, ...props }: { icon: LucideIcon; size?: number } & LucideProps) {
  return <IconComponent size={size} strokeWidth={1.9} aria-hidden="true" {...props} />;
}

function Avatar({ initials, tone = "primary" }: { initials: string; tone?: "primary" | "warm" | "dark" }) {
  return <span className="portal-avatar" data-tone={tone}>{initials}</span>;
}

function SubjectMark({ subjectId, compact = false }: { subjectId: SubjectId; compact?: boolean }) {
  const subject = getSubject(subjectId);
  return (
    <span className="portal-subject-mark" data-subject={subjectId} title={subject.label}>
      <Icon icon={subjectIcon[subjectId]} size={compact ? 15 : 19} />
      {!compact && <span>{subject.label}</span>}
    </span>
  );
}

function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="portal-progress" aria-label={label ?? `${value}% complete`}>
      <span className="portal-progress__track"><span style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} /></span>
      {label ? <span className="portal-progress__label">{label}</span> : null}
    </div>
  );
}

function PageHeader({ eyebrow, title, detail, actions }: { eyebrow?: string; title: string; detail?: string; actions?: ReactNode }) {
  return (
    <header className="portal-page-header">
      <div>
        {eyebrow ? <p className="portal-eyebrow">{eyebrow}</p> : null}
        <h1 className="portal-page-title">{title}</h1>
        {detail ? <p className="portal-page-detail">{detail}</p> : null}
      </div>
      {actions ? <div className="portal-page-header__actions">{actions}</div> : null}
    </header>
  );
}

function CourseVisual({ course, small = false }: { course: Course; small?: boolean }) {
  const SubjectIcon = subjectIcon[course.subjectId];
  return (
    <div className="portal-course-visual" data-cover={course.cover} data-small={small} style={{ "--course-accent": course.accent } as CSSProperties}>
      <span className="portal-course-visual__orb portal-course-visual__orb--one" />
      <span className="portal-course-visual__orb portal-course-visual__orb--two" />
      <span className="portal-course-visual__line" />
      <Icon icon={SubjectIcon} size={small ? 22 : 34} />
      <span className="portal-course-visual__formula">{course.subjectId === "mathematics" ? "f(x)" : course.subjectId === "physics" ? "F=ma" : course.subjectId === "chemistry" ? "sp³" : "DNA"}</span>
    </div>
  );
}

function CourseCard({ course, action = "Open course" }: { course: Course; action?: string }) {
  return (
    <article className="portal-card portal-course-card" style={{ "--course-accent": course.accent } as CSSProperties}>
      <CourseVisual course={course} />
      <div className="portal-course-card__body">
        <div className="portal-inline-meta"><SubjectMark subjectId={course.subjectId} compact /><span>{course.enrollmentLabel}</span></div>
        <h2>{course.title}</h2>
        <p>{course.nextLessonTitle}</p>
        <div className="portal-course-card__progress"><Progress value={course.progress} label={`${course.progress}%`} /><span>{course.completedLessons}/{course.lessonCount} lessons</span></div>
        <Link className="portal-button portal-button--quiet portal-button--inline" href={`/portal/learn/${course.id}`}>{action}<Icon icon={ArrowRight} size={16} /></Link>
      </div>
    </article>
  );
}

function NavList({ items, currentRoute, compact = false }: { items: readonly PortalNavItem[]; currentRoute: PortalRouteKey; compact?: boolean }) {
  return (
    <nav className={compact ? "portal-bottom-nav" : "portal-nav"} aria-label={compact ? "Primary mobile navigation" : "Primary navigation"}>
      {items.map((item) => {
        const NavIcon = navIcons[item.icon];
        const isCurrent = item.route === currentRoute || (item.route === "live" && currentRoute === "live-class");
        return (
          <Link href={item.href} key={item.href} aria-current={isCurrent ? "page" : undefined} className={item.route === "live" ? "portal-live-nav-action" : undefined}>
            <span className="portal-nav__icon"><Icon icon={NavIcon} size={compact ? 20 : 18} />{item.badge ? <i>{item.badge}</i> : null}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function HomeScreen({ showToast }: { showToast: (message: string) => void }) {
  const nextClass = liveClasses[0];
  const resume = courses[0];
  return (
    <>
      <section className="portal-hero portal-hero--pulse">
        <div className="portal-hero__copy">
          <p className="portal-eyebrow">Tuesday, 30 July</p>
          <h1>Make today’s study time count.</h1>
          <p>{portalDemoData.student.todayGoalLabel}. You are building a strong week.</p>
          <div className="portal-hero__actions">
            <Link href={`/portal/learn/${resume.id}/lessons/${resume.nextLessonId}`} className="portal-button"><Play size={16} fill="currentColor" />Resume learning</Link>
            <button type="button" className="portal-button portal-button--ghost" onClick={() => showToast("Your daily plan is ready.")}><CalendarDays size={16} />View plan</button>
          </div>
        </div>
        <div className="portal-momentum" aria-label="This week’s study momentum">
          <div className="portal-momentum__orbit"><span>12</span><small>day streak</small></div>
          <div className="portal-momentum__bar"><span style={{ height: "48%" }} /><span style={{ height: "72%" }} /><span style={{ height: "58%" }} /><span style={{ height: "88%" }} /><span style={{ height: "65%" }} /><span style={{ height: "90%" }} /><span style={{ height: "74%" }} /></div>
        </div>
      </section>

      <section className="portal-section">
        <div className="portal-section-heading"><div><p className="portal-eyebrow">Up next</p><h2>Keep your flow</h2></div><Link href="/portal/live">See agenda <ChevronRight size={16} /></Link></div>
        <div className="portal-card-grid portal-card-grid--next">
          <article className="portal-card portal-next-class" data-state="live">
            <div className="portal-status" data-tone="live"><span className="portal-live-dot" />Live in 18 min</div>
            <div className="portal-next-class__title"><SubjectMark subjectId={nextClass.subjectId} compact /><h3>{nextClass.title}</h3></div>
            <p><Avatar initials={nextClass.educatorInitials} />{nextClass.educatorName} · {nextClass.duration}</p>
            <Link href={`/portal/live/${nextClass.id}`} className="portal-button portal-button--coral">Join class <ArrowRight size={16} /></Link>
          </article>
          <article className="portal-card portal-resume-card">
            <div className="portal-resume-card__visual"><CourseVisual course={resume} small /></div>
            <div><p className="portal-eyebrow">Continue</p><h3>{resume.nextLessonTitle}</h3><p>{resume.progress}% through {resume.title}</p><Progress value={resume.progress} /></div>
            <Link href={`/portal/learn/${resume.id}/lessons/${resume.nextLessonId}`} className="portal-icon-button" aria-label="Continue lesson"><Play size={17} fill="currentColor" /></Link>
          </article>
        </div>
      </section>

      <section className="portal-section portal-section--split">
        <div>
          <div className="portal-section-heading"><div><p className="portal-eyebrow">Your subjects</p><h2>Small steps, real progress</h2></div><Link href="/portal/learn">Library <ChevronRight size={16} /></Link></div>
          <div className="portal-subject-grid">
            {courses.map((course) => <Link href={`/portal/learn/${course.id}`} key={course.id} className="portal-card portal-subject-card" data-subject={course.subjectId}><SubjectMark subjectId={course.subjectId} /><strong>{course.progress}%</strong><Progress value={course.progress} /><span>{course.completedLessons} lessons done</span></Link>)}
          </div>
        </div>
        <article className="portal-card portal-streak-card">
          <span className="portal-streak-card__icon"><Flame size={23} /></span>
          <p className="portal-eyebrow">Study streak</p><h2>12 days</h2><p>One focused session today keeps your streak glowing.</p>
          <div className="portal-streak-week" aria-label="Seven day study streak"><span /><span /><span /><span /><span /><span /><span data-today /></div>
          <button type="button" className="portal-button portal-button--quiet" onClick={() => showToast("Nice work — your study block is scheduled.")}>Plan a block</button>
        </article>
      </section>
    </>
  );
}

function LearnScreen() {
  return (
    <>
      <PageHeader eyebrow="Library" title="A path you can actually follow" detail="Lessons, replays, worksheets, and fast checks — organized around the way you learn." actions={<button className="portal-icon-button" type="button" aria-label="Search library"><Search size={19} /></button>} />
      <div className="portal-subject-scroll" aria-label="Subject filters"><button type="button" data-active>All subjects</button>{subjects.map((subject) => <button type="button" key={subject.id}><Icon icon={subjectIcon[subject.id]} size={16} />{subject.label}</button>)}</div>
      <section className="portal-card-grid portal-card-grid--courses">{courses.map((course) => <CourseCard course={course} key={course.id} />)}</section>
    </>
  );
}

function CourseDetailScreen({ courseId }: { courseId?: string }) {
  const course = getCourse(courseId);
  const courseLessons = lessons.filter((lesson) => lesson.courseId === course.id);
  return (
    <>
      <Link href="/portal/learn" className="portal-back-link"><ArrowLeft size={17} />Library</Link>
      <section className="portal-course-hero" style={{ "--course-accent": course.accent } as CSSProperties}>
        <CourseVisual course={course} />
        <div><SubjectMark subjectId={course.subjectId} /><h1>{course.title}</h1><p>{course.description}</p><div className="portal-course-hero__meta"><Avatar initials={course.educatorInitials} />{course.educatorName}<span>·</span>{course.duration}<span>·</span>{course.lessonCount} lessons</div><Progress value={course.progress} label={`${course.progress}% complete`} /></div>
        <Link href={`/portal/learn/${course.id}/lessons/${course.nextLessonId}`} className="portal-button"><Play size={16} fill="currentColor" />Continue</Link>
      </section>
      <section className="portal-section"><div className="portal-section-heading"><div><p className="portal-eyebrow">Course roadmap</p><h2>Learn in a calm sequence</h2></div><button type="button" className="portal-button portal-button--quiet"><Download size={16} />Download</button></div><div className="portal-lesson-list">{courseLessons.map((lesson, index) => <LessonRow key={lesson.id} course={course} lesson={lesson} index={index + 1} />)}</div></section>
    </>
  );
}

function LessonRow({ course, lesson, index }: { course: Course; lesson: (typeof lessons)[number]; index: number }) {
  const KindIcon = lesson.kind === "video" ? Play : lesson.kind === "quiz" ? ClipboardCheck : FileText;
  return <Link href={`/portal/learn/${course.id}/lessons/${lesson.id}`} className="portal-lesson-row" data-complete={lesson.completed}><span className="portal-lesson-row__index">{lesson.completed ? <Check size={17} /> : index}</span><span className="portal-lesson-row__type"><Icon icon={KindIcon} size={18} /></span><span className="portal-lesson-row__copy"><strong>{lesson.title}</strong><small>{lesson.section} · {lesson.duration}</small>{lesson.progress ? <Progress value={lesson.progress} /> : null}</span>{lesson.locked ? <LockKeyhole size={16} /> : <ChevronRight size={18} />}</Link>;
}

function LessonScreen({ courseId, lessonId, showToast }: { courseId?: string; lessonId?: string; showToast: (message: string) => void }) {
  const course = getCourse(courseId);
  const lesson = getLesson(lessonId);
  const [notesOpen, setNotesOpen] = useState(false);
  return (
    <>
      <Link href={`/portal/learn/${course.id}`} className="portal-back-link"><ArrowLeft size={17} />{course.title}</Link>
      <div className="portal-lesson-layout">
        <section className="portal-player" data-subject={course.subjectId}>
          <div className="portal-player__screen"><span className="portal-player__mesh" /><div className="portal-player__teacher"><Avatar initials={course.educatorInitials} tone="dark" /><span>{course.educatorName}</span></div><button type="button" className="portal-player__play" aria-label="Play lesson" onClick={() => showToast("Lesson playback is ready in this interactive preview.")}><Play size={25} fill="currentColor" /></button><p>Frame of reference · 07:24 / 24:00</p></div>
          <div className="portal-player__controls"><button type="button" aria-label="Pause"><Pause size={18} /></button><div><span /></div><span>07:24</span><button type="button" aria-label="Volume"><Volume2 size={18} /></button><button type="button" aria-label="Playback settings"><Settings2 size={18} /></button></div>
        </section>
        <aside className="portal-lesson-side"><p className="portal-eyebrow">Now learning</p><h1>{lesson.title}</h1><p>{lesson.section} · {lesson.duration}</p><div className="portal-quick-check"><span><Lightbulb size={18} /></span><div><strong>Quick check</strong><p>Which frame lets you treat the river as stationary?</p><button type="button" onClick={() => showToast("Answer saved: choose the river frame.")}>Answer in 10 sec <ArrowRight size={15} /></button></div></div><button type="button" className="portal-button portal-button--quiet portal-button--full" onClick={() => setNotesOpen(true)}><FileText size={16} />Open notes</button></aside>
      </div>
      {notesOpen ? <PortalSheet title="Lesson notes" onClose={() => setNotesOpen(false)}><textarea className="portal-note-input" aria-label="Lesson notes" defaultValue="Reference frame: pick the object whose velocity you want to make zero.\n\nReview: river + boat examples." /><button className="portal-button" type="button" onClick={() => { setNotesOpen(false); showToast("Notes saved for offline review."); }}><Check size={16} />Save notes</button></PortalSheet> : null}
    </>
  );
}

function LiveScheduleScreen() {
  return <>
    <PageHeader eyebrow="Live learning" title="Show up, ask, understand." detail="Your upcoming rooms and recordings, all in one place." />
    <section className="portal-live-schedule">{liveClasses.map((liveClass) => <LiveCard key={liveClass.id} liveClass={liveClass} />)}</section>
    <section className="portal-section"><div className="portal-section-heading"><div><p className="portal-eyebrow">Replay when you need it</p><h2>Keep the explanation close</h2></div><Link href="/portal/recordings">All recordings <ChevronRight size={16} /></Link></div><div className="portal-recording-strip">{courses.slice(0, 3).map((course) => <Link className="portal-recording-card" href={`/portal/learn/${course.id}`} key={course.id}><CourseVisual course={course} small /><span><strong>{course.title}</strong><small>Download available</small></span><Download size={17} /></Link>)}</div></section>
  </>;
}

function RecordingsScreen({ showToast }: { showToast: (message: string) => void }) {
  return <>
    <PageHeader eyebrow="Watch it your way" title="Your replay library" detail="Every saved class keeps its chapter markers, notes, and companion worksheet together." actions={<Link href="/portal/downloads" className="portal-button portal-button--quiet"><Download size={16} />Downloads</Link>} />
    <section className="portal-recording-library">{liveClasses.filter((liveClass) => liveClass.status !== "upcoming").map((liveClass, index) => <article className="portal-card portal-recording-library__item" key={liveClass.id}><div className="portal-recording-library__cover" data-subject={liveClass.subjectId}><span>{index + 1}</span><Play size={23} fill="currentColor" /></div><div><SubjectMark subjectId={liveClass.subjectId} compact /><h2>{liveClass.title}</h2><p>{liveClass.educatorName} · {liveClass.duration} · {liveClass.dateLabel}</p><div><span className="portal-chip">Chapter markers</span><span className="portal-chip">Notes included</span></div></div><aside><button type="button" className="portal-icon-button" onClick={() => showToast(`${liveClass.title} is ready offline.`)} aria-label={`Download ${liveClass.title}`}><Download size={18} /></button><Link href={`/portal/live/${liveClass.id}`} className="portal-button">Watch <Play size={15} fill="currentColor" /></Link></aside></article>)}</section>
    <section className="portal-empty"><span><Headphones size={26} /></span><div><h2>Make a replay your revision partner</h2><p>Bookmark a moment, add a note, and return to the exact explanation before your test.</p></div><button type="button" className="portal-button portal-button--quiet" onClick={() => showToast("Your next live class will be saved here when it ends.")}>How replays work <CircleHelp size={16} /></button></section>
  </>;
}

function LiveCard({ liveClass }: { liveClass: LiveClass }) {
  const isLive = liveClass.status === "live";
  return <article className="portal-card portal-live-card" data-state={liveClass.status}><div className="portal-live-card__top"><SubjectMark subjectId={liveClass.subjectId} compact /><span className="portal-status" data-tone={isLive ? "live" : "quiet"}>{isLive ? <><span className="portal-live-dot" />LIVE NOW</> : liveClass.status === "recorded" ? "RECORDING" : "UP NEXT"}</span></div><h2>{liveClass.title}</h2><p>{liveClass.goal}</p><div className="portal-live-card__meta"><Avatar initials={liveClass.educatorInitials} />{liveClass.educatorName}<span>·</span><Clock3 size={15} />{liveClass.duration}</div><div className="portal-live-card__bottom"><span>{liveClass.startsAt}</span><Link href={`/portal/live/${liveClass.id}`} className="portal-button">{isLive ? "Join room" : liveClass.status === "recorded" ? "Watch replay" : "Set reminder"}<ArrowRight size={16} /></Link></div></article>;
}

function LiveClassScreen({ classId, role, showToast }: { classId?: string; role: "student" | "educator"; showToast: (message: string) => void }) {
  const liveClass = getLiveClass(classId);
  const [sheet, setSheet] = useState<LiveSheet>(null);
  const [raised, setRaised] = useState(false);
  return <div className="portal-live-shell">
    <div className="portal-live-stage" data-subject={liveClass.subjectId}>
      <div className="portal-live-ribbon"><span className="portal-live-dot" />LIVE <span>·</span>{liveClass.roomLabel}<span>·</span>{liveClass.attendees} learners</div>
      <div className="portal-live-goal"><p>Today’s goal</p><strong>{liveClass.goal}</strong></div>
      <div className="portal-live-board"><span className="portal-live-board__grid" /><span className="portal-live-board__line portal-live-board__line--one" /><span className="portal-live-board__line portal-live-board__line--two" /><span className="portal-live-board__formula">v⃗<sub>boat</sub> = v⃗<sub>river</sub> + v⃗<sub>relative</sub></span><span className="portal-live-board__tag">Question 04</span></div>
      <div className="portal-live-pip"><Avatar initials={liveClass.educatorInitials} tone="dark" /><span><strong>{liveClass.educatorName}</strong><small>Teaching live</small></span><Video size={17} /></div>
      <div className="portal-live-controls"><button type="button" aria-label="Toggle microphone"><Mic size={20} /></button><button type="button" aria-label="Toggle camera"><Camera size={20} /></button><button type="button" className={raised ? "is-active" : undefined} onClick={() => { setRaised(!raised); showToast(raised ? "Hand lowered." : "Your hand is raised."); }} aria-label="Raise hand"><Hand size={20} /></button><button type="button" onClick={() => setSheet("poll")} aria-label="Open poll"><ClipboardCheck size={20} /></button><button type="button" onClick={() => setSheet("materials")} aria-label="Open materials"><Layers3 size={20} /></button><button type="button" onClick={() => setSheet("chat")} aria-label="Open chat"><MessageCircle size={20} /></button>{role === "educator" ? <button type="button" className="portal-button portal-button--coral" onClick={() => showToast("Your recap is queued for the class.")}>End & recap</button> : <button type="button" className="portal-button portal-button--quiet" onClick={() => showToast("You left the demo room.")}>Leave</button>}</div>
    </div>
    <aside className="portal-live-context"><div className="portal-live-context__heading"><div><p className="portal-eyebrow">Class pulse</p><h2>Stay with the room</h2></div><span className="portal-status" data-tone="success"><Wifi size={13} />Strong</span></div><button type="button" onClick={() => setSheet("questions")}><CircleHelp size={18} /><span><strong>Q&A</strong><small>4 questions waiting</small></span><ChevronRight size={17} /></button><button type="button" onClick={() => setSheet("materials")}><FileText size={18} /><span><strong>Class materials</strong><small>Worksheet + formula sheet</small></span><ChevronRight size={17} /></button><button type="button" onClick={() => setSheet("roster")}><UsersRound size={18} /><span><strong>{role === "educator" ? "Attendance" : "People in class"}</strong><small>{liveClass.attendees} learning together</small></span><ChevronRight size={17} /></button></aside>
    {sheet ? <LiveDrawer kind={sheet} onClose={() => setSheet(null)} showToast={showToast} role={role} /> : null}
  </div>;
}

function LiveDrawer({ kind, onClose, showToast, role }: { kind: Exclude<LiveSheet, null>; onClose: () => void; showToast: (message: string) => void; role: "student" | "educator" }) {
  const title = kind === "chat" ? "Class chat" : kind === "questions" ? "Q&A" : kind === "poll" ? "Quick poll" : kind === "materials" ? "Materials" : role === "educator" ? "Attendance" : "In this class";
  const [draft, setDraft] = useState("");
  return <PortalSheet title={title} onClose={onClose} live>
    {kind === "chat" ? <div className="portal-chat">{liveMessages.map((message) => <div className="portal-chat__message" data-mine={message.mine} key={message.id}><Avatar initials={message.initials} /><div><strong>{message.author}</strong><p>{message.body}</p><small>{message.timeLabel}</small></div></div>)}<form onSubmit={(event) => { event.preventDefault(); if (draft.trim()) { showToast("Message sent to the room."); setDraft(""); } }} className="portal-chat__input"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Say something helpful…" aria-label="Message the class" /><button type="submit" aria-label="Send message"><Send size={18} /></button></form></div> : null}
    {kind === "questions" ? <div className="portal-stack">{doubts.slice(0, 2).map((doubt) => <article className="portal-doubt-card" key={doubt.id}><SubjectMark subjectId={doubt.subjectId} compact /><h3>{doubt.title}</h3><p>{doubt.body}</p><button type="button" onClick={() => showToast("Your question is pinned for the educator.")}>Upvote question <ArrowRight size={15} /></button></article>)}</div> : null}
    {kind === "poll" ? <div className="portal-poll"><p className="portal-eyebrow">One question</p><h3>Which frame makes the river speed zero?</h3>{["The boat frame", "The river frame", "The shore frame"].map((answer) => <button type="button" onClick={() => showToast(`Vote saved: ${answer}`)} key={answer}>{answer}<ChevronRight size={17} /></button>)}</div> : null}
    {kind === "materials" ? <div className="portal-stack">{["Relative-motion worksheet", "Sign conventions cheat sheet", "Class replay marker notes"].map((item, index) => <button type="button" className="portal-material" onClick={() => showToast(`${item} is ready offline.`)} key={item}><span><FileText size={19} /></span><div><strong>{item}</strong><small>{index === 0 ? "PDF · 4 pages" : "Saved for this class"}</small></div><Download size={18} /></button>)}</div> : null}
    {kind === "roster" ? <div className="portal-stack">{learners.map((learner) => <div className="portal-roster-row" key={learner.id}><Avatar initials={learner.initials} /><span><strong>{learner.name}</strong><small>Here now · {learner.attendance}% attendance</small></span>{role === "educator" ? <button type="button" onClick={() => showToast(`${learner.name} marked present.`)}><Check size={17} />Present</button> : <span className="portal-status" data-tone="success">Here</span>}</div>)}</div> : null}
  </PortalSheet>;
}

function PracticeScreen({ showToast }: { showToast: (message: string) => void }) {
  return <><PageHeader eyebrow="Practice studio" title="Practice with purpose" detail="A little challenge, a clear next step, and no noisy distractions." actions={<Link href="/portal/results" className="portal-button portal-button--quiet">View results <ArrowRight size={16} /></Link>} /><section className="portal-card-grid portal-card-grid--practice">{practiceSets.map((set) => <article className="portal-card portal-practice-card" key={set.id}><div><SubjectMark subjectId={set.subjectId} compact /><span className="portal-chip">{set.difficulty}</span></div><h2>{set.title}</h2><p>{set.questionCount} questions · {set.duration}</p>{set.completion ? <Progress value={set.completion} label={`${set.completion}% complete`} /> : <p className="portal-practice-card__due"><TimerReset size={16} />{set.dueLabel}</p>}<Link href={`/portal/practice/${set.id}`} className="portal-button">{set.completion ? "Continue" : "Start focus set"}<ArrowRight size={16} /></Link></article>)}</section><section className="portal-recovery-plan"><div><p className="portal-eyebrow">Your next revision loop</p><h2>Turn one missed concept into a win.</h2><p>Spend 12 minutes on relative velocity signs, then try five fresh questions.</p></div><Link href="/portal/learn/physics-motion/lessons/relative-motion" className="portal-button portal-button--light">Open revision <ArrowRight size={16} /></Link></section></>;
}

function TestScreen({ testId, showToast }: { testId?: string; showToast: (message: string) => void }) {
  const practiceSet = practiceSets.find((set) => set.id === testId) ?? practiceSets[0];
  const [answer, setAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  return <div className="portal-practice-shell"><header className="portal-test-topbar"><Link href="/portal/practice" aria-label="Exit practice"><X size={20} /></Link><div><span>Question 4 of {practiceSet.questionCount}</span><Progress value={27} /></div><span><Clock3 size={16} />18:42</span></header><main className="portal-question-card"><SubjectMark subjectId={practiceSet.subjectId} compact /><p className="portal-eyebrow">Mechanics · build confidence</p><h1>A boat moves due north relative to water. The river flows east. In which direction does the boat move relative to the shore?</h1><div className="portal-answer-list">{["Due north", "North-east", "Due east", "It remains still"].map((option, index) => <button type="button" key={option} data-selected={answer === index} data-correct={answered && index === 1} onClick={() => setAnswer(index)}><span>{String.fromCharCode(65 + index)}</span>{option}{answered && index === 1 ? <CheckCircle2 size={19} /> : null}</button>)}</div><div className="portal-question-card__footer"><button type="button" className="portal-button portal-button--quiet"><ArrowLeft size={16} />Previous</button><button type="button" className="portal-button" onClick={() => { if (answer === null) showToast("Choose an answer first."); else setAnswered(true); }}>{answered ? "Continue" : "Check answer"}<ArrowRight size={16} /></button></div>{answered ? <div className="portal-answer-feedback"><CheckCircle2 size={20} /><div><strong>Exactly — vector addition gives a north-east result.</strong><p>You kept both the boat and river velocities in view.</p></div></div> : null}</main><aside className="portal-question-nav"><p>Question map</p><div>{Array.from({ length: practiceSet.questionCount }, (_, index) => <button key={index} data-active={index === 3} data-complete={index < 3}>{index + 1}</button>)}</div><button type="button" onClick={() => showToast("Question marked for review.")}>Flag for review</button></aside></div>;
}

function ResultsScreen() {
  const result = testResults[0];
  return <><PageHeader eyebrow="Progress, not pressure" title="See what to revise next" detail="Your results become a calmer plan for the next study block." /><section className="portal-results-summary"><div className="portal-results-score"><span>{result.score}</span><small>out of {result.total}</small></div><div><SubjectMark subjectId={result.subjectId} /><h2>{result.title}</h2><p>{result.improvement} · {result.dateLabel}</p><div className="portal-results-bars"><span style={{ height: "86%" }} /><span style={{ height: "61%" }} /><span style={{ height: "75%" }} /><span style={{ height: "92%" }} /><span style={{ height: "82%" }} /></div></div><div className="portal-results-percentile"><strong>{result.percentile}<small>th</small></strong><span>percentile</span></div></section><section className="portal-card-grid portal-card-grid--results">{testResults.map((item) => <article className="portal-card" key={item.id}><SubjectMark subjectId={item.subjectId} compact /><h3>{item.title}</h3><strong>{item.score}/{item.total}</strong><p>{item.improvement}</p><Progress value={(item.score / item.total) * 100} /></article>)}</section><section className="portal-card portal-revision-card"><span><Lightbulb size={24} /></span><div><p className="portal-eyebrow">Your best next move</p><h2>{result.focusTopic}</h2><p>One short lesson, then a five-question check while the idea is fresh.</p></div><Link href="/portal/learn/physics-motion/lessons/relative-motion" className="portal-button">Start revision <ArrowRight size={16} /></Link></section></>;
}

function DoubtsScreen({ showToast }: { showToast: (message: string) => void }) {
  const [composer, setComposer] = useState(false);
  return <><PageHeader eyebrow="Ask without waiting" title="Your doubt room" detail="Get unstuck with classmates, educators, and saved explanations." actions={<button type="button" className="portal-button" onClick={() => setComposer(true)}><Plus size={17} />Ask a doubt</button>} /><div className="portal-doubt-feed">{doubts.map((doubt) => <article className="portal-card portal-doubt-feed__item" key={doubt.id}><div><Avatar initials={doubt.authorInitials} /><span><SubjectMark subjectId={doubt.subjectId} compact /><small>{doubt.author} · {doubt.timeLabel}</small></span><span className="portal-chip" data-status={doubt.status}>{doubt.status}</span></div><h2>{doubt.title}</h2><p>{doubt.body}</p>{doubt.acceptedAnswer ? <div className="portal-accepted-answer"><CheckCircle2 size={18} /><span><strong>Accepted explanation</strong>{doubt.acceptedAnswer}</span></div> : null}<footer><button type="button" onClick={() => showToast("Helpful vote added.")}><Sparkles size={16} />Helpful</button><button type="button" onClick={() => showToast("Thread opened.")}><MessageCircle size={16} />{doubt.replyCount} replies</button></footer></article>)}</div>{composer ? <PortalSheet title="Ask your doubt" onClose={() => setComposer(false)}><div className="portal-compose"><label>Subject<select defaultValue="physics"><option value="physics">Physics</option><option value="chemistry">Chemistry</option><option value="mathematics">Mathematics</option></select></label><label>What’s blocking you?<textarea placeholder="Add the question, a photo, or where the explanation stopped making sense." /></label><div><button type="button" className="portal-button portal-button--quiet" onClick={() => showToast("Image attachment picker is ready.")}><Upload size={16} />Attach image</button><button type="button" className="portal-button" onClick={() => { setComposer(false); showToast("Your doubt is now in the room."); }}><Send size={16} />Post doubt</button></div></div></PortalSheet> : null}</>;
}

function InboxScreen() {
  return <><PageHeader eyebrow="Stay in the loop" title="Your study inbox" detail="Only the important things: classes, results, replies, and downloads." /><section className="portal-inbox">{notifications.map((notification) => <article className="portal-notification-row" key={notification.id} data-unread={notification.unread}><span><Icon icon={notification.type === "live" ? Radio : notification.type === "result" ? Trophy : notification.type === "doubt" ? MessageCircle : Download} size={19} /></span><div><h2>{notification.title}</h2><p>{notification.body}</p></div><time>{notification.timeLabel}</time></article>)}</section></>;
}

function ProfileScreen({ theme, setTheme, showToast }: { theme: PortalTheme; setTheme: (theme: PortalTheme) => void; showToast: (message: string) => void }) {
  return <><section className="portal-profile-hero"><Avatar initials={portalDemoData.student.initials} /><div><p className="portal-eyebrow">{portalDemoData.student.classLabel}</p><h1>{portalDemoData.student.name}</h1><p><Flame size={16} />{portalDemoData.student.streak}-day study streak</p></div><button type="button" className="portal-icon-button" onClick={() => showToast("Profile editing is ready in this product preview.")} aria-label="Edit profile"><Settings2 size={18} /></button></section><section className="portal-card portal-account-card"><div><p className="portal-eyebrow">Design direction</p><h2>Make the portal yours</h2><p>Switch between the energetic Pulse Campus and calm Focus Atlas directions.</p></div><div className="portal-theme-switch" role="group" aria-label="Portal design direction"><button type="button" data-active={theme === "pulse"} onClick={() => setTheme("pulse")}>Pulse<br /><small>Campus</small></button><button type="button" data-active={theme === "atlas"} onClick={() => setTheme("atlas")}>Focus<br /><small>Atlas</small></button></div></section><section className="portal-settings-list"><Link href="/portal/downloads"><Download size={19} /><span><strong>Downloads</strong><small>3 lessons ready offline</small></span><ChevronRight size={17} /></Link><button type="button" onClick={() => showToast("Notifications are tuned to your study calendar.")}><Bell size={19} /><span><strong>Notifications</strong><small>Classes and important replies</small></span><ChevronRight size={17} /></button><button type="button" onClick={() => showToast("Support is ready to help.")}><CircleHelp size={19} /><span><strong>Help & support</strong><small>Get help with your study flow</small></span><ChevronRight size={17} /></button></section><section className="portal-auth-preview"><div><p className="portal-eyebrow">Account experience</p><h2>Simple sign-in, no friction.</h2><p>Phone or email verification, a clear setup path, and quiet privacy controls.</p></div><button type="button" className="portal-button portal-button--quiet" onClick={() => showToast("The onboarding preview includes OTP sign-in and subject selection.")}>Preview onboarding <ArrowRight size={16} /></button></section></>;
}

function DownloadsScreen({ showToast }: { showToast: (message: string) => void }) {
  return <><PageHeader eyebrow="Offline ready" title="Your study kit travels with you" detail="Saved lessons stay available when your connection does not." /><section className="portal-download-list">{courses.slice(0, 3).map((course) => <article className="portal-card" key={course.id}><CourseVisual course={course} small /><div><h2>{course.title}</h2><p>3 lessons · 214 MB available offline</p><Progress value={100} label="Downloaded" /></div><button type="button" className="portal-icon-button" onClick={() => showToast(`${course.title} is safely stored on this device.`)} aria-label={`Manage ${course.title} download`}><MoreHorizontal size={19} /></button></article>)}</section><section className="portal-empty"><span><Headphones size={26} /></span><div><h2>Save a live replay for later</h2><p>Open any recording and choose Download. We will keep its notes and worksheet together.</p></div><Link href="/portal/recordings" className="portal-button portal-button--quiet">Browse replays</Link></section></>;
}

function OfflineScreen({ showToast }: { showToast: (message: string) => void }) {
  return <section className="portal-offline-state"><div className="portal-offline-state__visual"><Wifi size={31} /><span /><span /><span /></div><p className="portal-eyebrow">Connection paused</p><h1>Keep learning. We’ll catch up when you’re back.</h1><p>Your downloaded lessons, notes, and practice remain ready on this device.</p><div><button type="button" className="portal-button" onClick={() => showToast("Trying your connection again…")}>Try again <Wifi size={16} /></button><Link href="/portal/downloads" className="portal-button portal-button--quiet">Open downloads</Link></div><aside><strong>Need help?</strong><span>Your last note and answer choices are stored locally until connection returns.</span></aside></section>;
}

function EducatorHome({ showToast }: { showToast: (message: string) => void }) {
  return <><PageHeader eyebrow="Teach today" title="A clear room, ready learners." detail="Your schedule, teaching signals, and next actions — in one calm view." actions={<Link href="/portal/educator/classes/live-relative-motion" className="portal-button"><Video size={16} />Open control room</Link>} /><section className="portal-teach-hero"><div><span className="portal-status" data-tone="live"><span className="portal-live-dot" />Starts in 18 min</span><h2>Relative motion: live problem lab</h2><p>128 learners enrolled · Worksheet and poll are ready.</p><div><Link href="/portal/educator/classes/live-relative-motion" className="portal-button portal-button--light"><Play size={16} fill="currentColor" />Launch class</Link><button type="button" className="portal-button portal-button--ghost" onClick={() => showToast("Your launch checklist is complete.")}>Review checklist</button></div></div><div className="portal-launch-checklist"><p>Launch checklist</p>{["Worksheet attached", "Poll ready", "Captions enabled"].map((item) => <span key={item}><CheckCircle2 size={16} />{item}</span>)}</div></section><section className="portal-card-grid portal-card-grid--teacher"><article className="portal-card"><p className="portal-eyebrow">Attendance</p><strong>92%</strong><span>+4% this week</span><Progress value={92} /></article><article className="portal-card"><p className="portal-eyebrow">Doubts to answer</p><strong>6</strong><span>Two need a quick reply</span><Link href="/portal/educator/doubts">Open queue <ArrowRight size={15} /></Link></article><article className="portal-card"><p className="portal-eyebrow">Learners at risk</p><strong>3</strong><span>Send a gentle nudge today</span><Link href="/portal/educator/learners">View learners <ArrowRight size={15} /></Link></article></section><section className="portal-section"><div className="portal-section-heading"><div><p className="portal-eyebrow">Attention signals</p><h2>Know who needs you most</h2></div><Link href="/portal/educator/insights">All insights <ChevronRight size={16} /></Link></div><div className="portal-risk-list">{learners.slice(0, 3).map((learner) => <article key={learner.id}><Avatar initials={learner.initials} /><div><strong>{learner.name}</strong><small>{learner.lastActive} · {learner.progress}% course progress</small></div><span className="portal-chip" data-status={learner.confidence === "At risk" ? "open" : learner.confidence === "Needs a nudge" ? "follow-up" : "answered"}>{learner.confidence}</span><button type="button" onClick={() => showToast(`Nudge sent to ${learner.name}.`)}>Nudge <Send size={15} /></button></article>)}</div></section></>;
}

function EducatorClassesScreen() {
  return <><PageHeader eyebrow="Teaching calendar" title="Classes with room to breathe" detail="Launch live sessions, check recordings, and keep every learner connected." actions={<button type="button" className="portal-button"><Plus size={17} />Schedule class</button>} /><section className="portal-live-schedule">{liveClasses.map((liveClass) => <LiveCard key={liveClass.id} liveClass={liveClass} />)}</section></>;
}

function EducatorCoursesScreen({ showToast }: { showToast: (message: string) => void }) {
  return <><PageHeader eyebrow="Course studio" title="Publish the next clear step" detail="Lessons, worksheets, and replays arranged the way learners need them." actions={<button type="button" className="portal-button" onClick={() => showToast("A new lesson draft is ready.")}><Plus size={17} />New lesson</button>} /><section className="portal-card-grid portal-card-grid--courses">{courses.map((course) => <article className="portal-card portal-course-card" key={course.id}><CourseVisual course={course} /><div className="portal-course-card__body"><SubjectMark subjectId={course.subjectId} compact /><h2>{course.title}</h2><p>{course.lessonCount} lessons · {course.completedLessons} recently completed</p><div className="portal-publish-row"><span><CheckCircle2 size={16} />Published</span><button type="button" onClick={() => showToast(`${course.title} is open for editing.`)}>Edit course <ArrowRight size={15} /></button></div></div></article>)}</section></>;
}

function LearnersScreen({ showToast }: { showToast: (message: string) => void }) {
  return <><PageHeader eyebrow="Learner pulse" title="See the humans behind the numbers" detail="Celebrate momentum and offer a nudge before anyone falls behind." actions={<button type="button" className="portal-button portal-button--quiet"><Download size={16} />Export attendance</button>} /><section className="portal-card portal-roster-table"><header><span>Learner</span><span>Attendance</span><span>Progress</span><span>Signal</span></header>{learners.map((learner) => <div key={learner.id}><span><Avatar initials={learner.initials} /><b>{learner.name}</b><small>Active {learner.lastActive}</small></span><span>{learner.attendance}%</span><span><Progress value={learner.progress} label={`${learner.progress}%`} /></span><span><i data-status={learner.confidence === "At risk" ? "open" : learner.confidence === "Needs a nudge" ? "follow-up" : "answered"}>{learner.confidence}</i><button type="button" onClick={() => showToast(`A thoughtful nudge is on its way to ${learner.name}.`)}><Send size={15} /></button></span></div>)}</section></>;
}

function EducatorDoubtsScreen({ showToast }: { showToast: (message: string) => void }) {
  return <><PageHeader eyebrow="Doubt queue" title="Answer where it matters" detail="A tidy queue of learning moments waiting for your explanation." /><section className="portal-doubt-feed">{doubts.map((doubt) => <article className="portal-card portal-doubt-feed__item" key={doubt.id}><div><Avatar initials={doubt.authorInitials} /><span><SubjectMark subjectId={doubt.subjectId} compact /><small>{doubt.author} · {doubt.timeLabel}</small></span><span className="portal-chip" data-status={doubt.status}>{doubt.status}</span></div><h2>{doubt.title}</h2><p>{doubt.body}</p><footer><button type="button" className="portal-button portal-button--quiet" onClick={() => showToast("A reply draft has been opened.")}>Reply with explanation <ArrowRight size={15} /></button><button type="button" onClick={() => showToast("Doubt is pinned for the next live class.")}>Pin for class</button></footer></article>)}</section></>;
}

function EducatorInsightsScreen() {
  return <><PageHeader eyebrow="Class insights" title="Patterns you can act on" detail="A practical view of learning effort, attention, and revision needs." /><section className="portal-insight-grid"><article className="portal-card portal-insight-card"><p className="portal-eyebrow">Weekly attendance</p><strong>92%</strong><span className="portal-chart">{[62, 80, 72, 88, 84, 92, 90].map((height, index) => <i style={{ height: `${height}%` }} key={index} />)}</span><small>Up 4% from last week</small></article><article className="portal-card portal-insight-card"><p className="portal-eyebrow">Concept confidence</p><strong>74%</strong><div className="portal-radar"><span /><span /><span /><b>Motion</b></div><small>Relative frames need a recap</small></article><article className="portal-card"><p className="portal-eyebrow">Strongest learner signal</p><h2>Visual practice is working</h2><p>Students who completed the diagram worksheet improved 11% on the weekly check.</p><Link href="/portal/educator/courses">Open course studio <ArrowRight size={16} /></Link></article></section></>;
}

function EducatorProfileScreen({ theme, setTheme, showToast }: { theme: PortalTheme; setTheme: (theme: PortalTheme) => void; showToast: (message: string) => void }) {
  return <>
    <section className="portal-profile-hero"><Avatar initials={portalDemoData.educator.initials} tone="dark" /><div><p className="portal-eyebrow">{portalDemoData.educator.roleLabel}</p><h1>{portalDemoData.educator.name}</h1><p><CheckCircle2 size={16} />Live classroom host</p></div><button type="button" className="portal-icon-button" onClick={() => showToast("Educator profile editing is ready in this preview.")} aria-label="Edit educator profile"><Settings2 size={18} /></button></section>
    <section className="portal-card portal-account-card"><div><p className="portal-eyebrow">Teaching workspace</p><h2>Quiet by default. Fast when it counts.</h2><p>Keep your class controls, learner signals, and publishing workspace comfortably focused.</p></div><div className="portal-theme-switch" role="group" aria-label="Portal design direction"><button type="button" data-active={theme === "pulse"} onClick={() => setTheme("pulse")}>Pulse<br /><small>Campus</small></button><button type="button" data-active={theme === "atlas"} onClick={() => setTheme("atlas")}>Focus<br /><small>Atlas</small></button></div></section>
    <section className="portal-settings-list"><button type="button" onClick={() => showToast("Live captions are enabled for your rooms.")}><Video size={19} /><span><strong>Live classroom defaults</strong><small>Captions, lobby, and recording controls</small></span><ChevronRight size={17} /></button><button type="button" onClick={() => showToast("Your teaching notifications are up to date.")}><Bell size={19} /><span><strong>Teaching notifications</strong><small>Class start, doubt queue, and learner nudges</small></span><ChevronRight size={17} /></button><button type="button" onClick={() => showToast("Educator support is ready to help.")}><CircleHelp size={19} /><span><strong>Support & class safety</strong><small>Moderation and classroom guidance</small></span><ChevronRight size={17} /></button></section>
  </>;
}

function PortalSheet({ title, onClose, children, live = false }: { title: string; onClose: () => void; children: ReactNode; live?: boolean }) {
  return <div className="portal-overlay" role="presentation"><button type="button" className="portal-overlay__backdrop" aria-label="Close panel" onClick={onClose} /><section className="portal-sheet" aria-modal="true" role="dialog" aria-label={title} data-live={live}><header><div><span className="portal-sheet__handle" /><h2>{title}</h2></div><button type="button" onClick={onClose} aria-label={`Close ${title}`}><X size={19} /></button></header><div className="portal-sheet__body">{children}</div></section></div>;
}

function PortalAuthPreview({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"welcome" | "verify" | "subjects">("welcome");
  return <PortalSheet title="Welcome to Study Portal" onClose={onClose}><div className="portal-auth"><div className="portal-auth__visual"><span><Sparkles size={26} /></span><i /><i /><i /></div>{step === "welcome" ? <><p className="portal-eyebrow">Your study space</p><h2>One calm place for every class.</h2><p>Lessons, live rooms, practice, doubts, and notes — shaped around your day.</p><button className="portal-button portal-button--full" type="button" onClick={() => setStep("verify")}>Continue with email <ArrowRight size={16} /></button></> : null}{step === "verify" ? <><p className="portal-eyebrow">Secure sign in</p><h2>Check your inbox for a code.</h2><div className="portal-otp"><input aria-label="Digit 1" maxLength={1} /><input aria-label="Digit 2" maxLength={1} /><input aria-label="Digit 3" maxLength={1} /><input aria-label="Digit 4" maxLength={1} /></div><button className="portal-button portal-button--full" type="button" onClick={() => setStep("subjects")}>Verify and continue <Check size={16} /></button></> : null}{step === "subjects" ? <><p className="portal-eyebrow">Make it yours</p><h2>What are you studying?</h2><div className="portal-auth__subjects">{subjects.map((subject) => <button type="button" key={subject.id}><Icon icon={subjectIcon[subject.id]} size={18} />{subject.label}<Check size={15} /></button>)}</div><button className="portal-button portal-button--full" type="button" onClick={onClose}>Open my portal <ArrowRight size={16} /></button></> : null}</div></PortalSheet>;
}

function getScreenForRoute(route: PortalRouteKey, segments: readonly string[], role: "student" | "educator", showToast: (message: string) => void, theme: PortalTheme, setTheme: (theme: PortalTheme) => void) {
  switch (route) {
    case "home": return <HomeScreen showToast={showToast} />;
    case "learn": return <LearnScreen />;
    case "course": return <CourseDetailScreen courseId={segments[1]} />;
    case "lesson": return <LessonScreen courseId={segments[1]} lessonId={segments[3]} showToast={showToast} />;
    case "live": return <LiveScheduleScreen />;
    case "live-class": return <LiveClassScreen classId={segments[1]} role={role} showToast={showToast} />;
    case "recordings": return <RecordingsScreen showToast={showToast} />;
    case "practice": return <PracticeScreen showToast={showToast} />;
    case "test": return <TestScreen testId={segments[1]} showToast={showToast} />;
    case "results": return <ResultsScreen />;
    case "doubts": return <DoubtsScreen showToast={showToast} />;
    case "inbox": return <InboxScreen />;
    case "profile": return <ProfileScreen theme={theme} setTheme={setTheme} showToast={showToast} />;
    case "downloads": return <DownloadsScreen showToast={showToast} />;
    case "offline": return <OfflineScreen showToast={showToast} />;
    case "educator-home": return <EducatorHome showToast={showToast} />;
    case "educator-classes": return <EducatorClassesScreen />;
    case "educator-class": return <LiveClassScreen classId={segments[2]} role="educator" showToast={showToast} />;
    case "educator-courses": return <EducatorCoursesScreen showToast={showToast} />;
    case "educator-learners": return <LearnersScreen showToast={showToast} />;
    case "educator-doubts": return <EducatorDoubtsScreen showToast={showToast} />;
    case "educator-insights": return <EducatorInsightsScreen />;
    case "educator-profile": return <EducatorProfileScreen theme={theme} setTheme={setTheme} showToast={showToast} />;
    default: return <HomeScreen showToast={showToast} />;
  }
}

export default function PortalClient({ pathname, segments }: PortalClientProps) {
  const route = useMemo(() => getPortalRoute(segments), [segments]);
  const initialRole = route.startsWith("educator") ? "educator" : "student";
  const [theme, setTheme] = useState<PortalTheme>("pulse");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const role = initialRole;
  const navigation = role === "educator" ? educatorNavigation : studentNavigation;
  const title = getPortalRouteTitle(segments);
  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? null : current), 2600);
  };
  const content = getScreenForRoute(route, segments, role, showToast, theme, setTheme);

  return <main className="portal-shell" data-portal-theme={theme} data-portal-path={pathname} data-role={role} data-route={route}>
    <header className="portal-topbar">
      <Link href="/portal" className="portal-brand" aria-label="Study Portal home"><span className="portal-brand__mark"><span /><span /><span /></span><span><strong>study<span>ly</span></strong><small>your coaching companion</small></span></Link>
      <div className="portal-topbar__context"><span className="portal-topbar__title">{title}</span><span className="portal-topbar__dot" /><span>{role === "educator" ? "Educator view" : "Student view"}</span></div>
      <div className="portal-topbar__actions"><button type="button" className="portal-theme-toggle" aria-label={`Switch to ${theme === "pulse" ? "Focus Atlas" : "Pulse Campus"}`} onClick={() => setTheme(theme === "pulse" ? "atlas" : "pulse")}><span>{theme === "pulse" ? <Zap size={14} /> : <Layers3 size={14} />}</span><b>{theme === "pulse" ? "Pulse" : "Atlas"}</b></button><Link href="/portal/inbox" className="portal-icon-button" aria-label="Open notifications"><Bell size={19} /><i>2</i></Link><button type="button" className="portal-avatar-button" onClick={() => setShowAuth(true)} aria-label="Open account preview"><Avatar initials={role === "educator" ? portalDemoData.educator.initials : portalDemoData.student.initials} /></button><button type="button" className="portal-menu-button" onClick={() => setShowMobileMenu(!showMobileMenu)} aria-label="Toggle navigation"><Menu size={21} /></button></div>
    </header>
    <aside className="portal-sidebar"><div className="portal-sidebar__identity"><Avatar initials={role === "educator" ? portalDemoData.educator.initials : portalDemoData.student.initials} /><span><strong>{role === "educator" ? portalDemoData.educator.name : portalDemoData.student.name}</strong><small>{role === "educator" ? portalDemoData.educator.roleLabel : portalDemoData.student.classLabel}</small></span></div><NavList items={navigation} currentRoute={route} /><div className="portal-sidebar__footer"><Link href={role === "student" ? "/portal/educator" : "/portal"}><GraduationCap size={18} />{role === "student" ? "Educator preview" : "Student preview"}</Link>{role === "educator" ? <Link href="/portal/educator/profile"><Settings2 size={18} />Account</Link> : <button type="button" onClick={() => setShowAuth(true)}><Settings2 size={18} />Account</button>}</div></aside>
    {showMobileMenu ? <div className="portal-mobile-menu"><NavList items={navigation} currentRoute={route} /><Link href={role === "student" ? "/portal/educator" : "/portal"}><GraduationCap size={18} />Switch preview</Link></div> : null}
    <div className="portal-main"><div className="portal-page">{content}</div></div>
    <NavList items={navigation} currentRoute={route} compact />
    {toast ? <div className="portal-toast" role="status"><CheckCircle2 size={18} />{toast}</div> : null}
    {showAuth ? <PortalAuthPreview onClose={() => setShowAuth(false)} /> : null}
  </main>;
}
