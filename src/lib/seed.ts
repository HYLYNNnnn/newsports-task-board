import {
  DEFAULT_LABELS,
  type Label,
  type Snapshot,
  type Status,
  type Task,
} from "../types";
import { dateOffset } from "./utils";

export function sampleSnapshot(userId: string): Snapshot {
  const now = new Date().toISOString();
  const members = [
    { name: "Alex Morgan", color: "#dbe7e4" },
    { name: "Jamie Park", color: "#e7def1" },
    { name: "Sam Rivera", color: "#f3e1ce" },
  ].map((member) => ({
    ...member,
    id: crypto.randomUUID(),
    user_id: userId,
    created_at: now,
  }));
  const content: {
    title: string;
    description: string;
    status: Status;
    priority: Task["priority"];
    labels: Label[];
    days: number;
    member: number;
  }[] = [
    {
      title: "Explore onboarding concepts",
      description:
        "Map out a welcoming first-run experience. Explore a few directions that help new players find their next favorite game.",
      status: "todo",
      priority: "high",
      labels: ["Design"],
      days: 2,
      member: 1,
    },
    {
      title: "Talk to our first players",
      description:
        "Prepare five questions and schedule discovery conversations with early community members.",
      status: "todo",
      priority: "normal",
      labels: ["Research"],
      days: 4,
      member: 0,
    },
    {
      title: "Plan the launch announcement",
      description:
        "Draft a story that shares what we are building and why we are excited about it.",
      status: "todo",
      priority: "low",
      labels: ["Marketing"],
      days: 6,
      member: 2,
    },
    {
      title: "Build the game discovery page",
      description:
        "Bring the discovery experience to life with clear categories, useful filters, and a little personality.",
      status: "in_progress",
      priority: "high",
      labels: ["Engineering"],
      days: 0,
      member: 0,
    },
    {
      title: "Create our visual language",
      description:
        "Define the colors, typography, and components that make the product feel distinctly ours.",
      status: "in_progress",
      priority: "normal",
      labels: ["Design"],
      days: 3,
      member: 1,
    },
    {
      title: "Fix mobile navigation overlap",
      description:
        "The navigation overlaps the bottom action on smaller devices. Check the safe area and touch target spacing.",
      status: "in_progress",
      priority: "high",
      labels: ["Bug", "Engineering"],
      days: -1,
      member: 2,
    },
    {
      title: "Review player profile screens",
      description:
        "Give the new profile flow a final look. Check empty states, accessibility, and the mobile layout.",
      status: "in_review",
      priority: "normal",
      labels: ["Design"],
      days: 1,
      member: 1,
    },
    {
      title: "Test the signup experience",
      description:
        "Walk through the guest signup journey on desktop and mobile. Note any friction or confusing copy.",
      status: "in_review",
      priority: "low",
      labels: ["Engineering"],
      days: 2,
      member: 2,
    },
    {
      title: "Set up the project workspace",
      description:
        "A shared place for ideas, tasks, and the work ahead. Everything has a home now.",
      status: "done",
      priority: "normal",
      labels: ["Engineering"],
      days: -3,
      member: 0,
    },
    {
      title: "Define our north star",
      description:
        "Make discovering your next favorite game feel as fun as playing it. That is the goal.",
      status: "done",
      priority: "normal",
      labels: ["Research"],
      days: -2,
      member: 0,
    },
  ];
  const tasks = content.map(({ days, member, ...task }, i) => ({
    ...task,
    id: crypto.randomUUID(),
    user_id: userId,
    due_date: dateOffset(days),
    assignee_id: members[member].id,
    created_at: new Date(
      Date.now() - (content.length - i) * 3600000,
    ).toISOString(),
    updated_at: now,
  }));
  return {
    tasks,
    members,
    labels: DEFAULT_LABELS.map((label) => ({
      ...label,
      id: crypto.randomUUID(),
      user_id: userId,
      created_at: now,
    })),
    comments: [
      {
        id: crypto.randomUUID(),
        user_id: userId,
        task_id: tasks[6].id,
        body: "The new direction looks great. Let’s double-check the empty state before we ship.",
        created_at: now,
      },
    ],
    activities: tasks.map((task) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      task_id: task.id,
      message: "Created this task",
      created_at: task.created_at,
    })),
  };
}
