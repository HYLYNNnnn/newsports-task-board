export const STATUSES = ["todo", "in_progress", "in_review", "done"] as const;
export type Status = (typeof STATUSES)[number];
export type Priority = "low" | "normal" | "high";
export type Label = string;
export const DEFAULT_LABELS = [
  { name: "Design", color: "#9c71a4" },
  { name: "Engineering", color: "#718bb4" },
  { name: "Research", color: "#a19060" },
  { name: "Marketing", color: "#789981" },
  { name: "Bug", color: "#b77e7e" },
];
export interface WorkspaceLabel {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}
export const COLUMNS: { id: Status; title: string; subtitle: string }[] = [
  { id: "todo", title: "To Do", subtitle: "Good ideas start here" },
  { id: "in_progress", title: "In Progress", subtitle: "Making things happen" },
  { id: "in_review", title: "In Review", subtitle: "A fresh pair of eyes" },
  { id: "done", title: "Done", subtitle: "A little closer to the goal" },
];
export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  due_date: string | null;
  assignee_id: string | null;
  labels: Label[];
  created_at: string;
  updated_at: string;
}
export type TaskInput = Pick<
  Task,
  | "title"
  | "description"
  | "status"
  | "priority"
  | "due_date"
  | "assignee_id"
  | "labels"
>;
export interface Member {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}
export interface Comment {
  id: string;
  user_id: string;
  task_id: string;
  body: string;
  created_at: string;
}
export interface Activity {
  id: string;
  user_id: string;
  task_id: string;
  message: string;
  created_at: string;
}
export interface Snapshot {
  tasks: Task[];
  members: Member[];
  comments: Comment[];
  activities: Activity[];
  labels: WorkspaceLabel[];
}
export interface BoardRepository {
  mode: "local" | "supabase";
  userId: string;
  load(): Promise<Snapshot>;
  createTask(input: TaskInput): Promise<void>;
  updateTask(id: string, input: TaskInput): Promise<void>;
  deleteTask(id: string): Promise<void>;
  addMember(name: string, color: string): Promise<void>;
  addComment(taskId: string, body: string): Promise<void>;
  addLabel(name: string, color: string): Promise<void>;
}
