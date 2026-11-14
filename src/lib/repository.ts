import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_LABELS,
  type BoardRepository,
  type Snapshot,
  type TaskInput,
} from "../types";
import { sampleSnapshot } from "./seed";
import { taskChanges } from "./utils";

export const LOCAL_STORAGE_PREFIX = "nextplay.board.v1.";
const GUEST_KEY = "nextplay.guest.v1";
const emptySnapshot = (): Snapshot => ({
  tasks: [],
  members: [],
  comments: [],
  activities: [],
  labels: [],
});

class LocalRepository implements BoardRepository {
  mode = "local" as const;
  userId: string;
  private key: string;
  constructor() {
    this.userId = localStorage.getItem(GUEST_KEY) || crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, this.userId);
    this.key = LOCAL_STORAGE_PREFIX + this.userId;
    if (!localStorage.getItem(this.key))
      this.write(sampleSnapshot(this.userId));
  }
  private read(): Snapshot {
    const raw = localStorage.getItem(this.key);
    if (!raw)
      throw new Error(
        "The local board is missing. Reload to initialize your workspace.",
      );
    try {
      const state = JSON.parse(raw) as Snapshot;
      // Upgrade v1 boards in memory; persist the new field with the next edit.
      // Existing tasks, IDs, comments and history remain untouched.
      if (state.labels === undefined) {
        const names = new Set([
          ...DEFAULT_LABELS.map((label) => label.name),
          ...(state.tasks || []).flatMap((task) => task.labels || []),
        ]);
        state.labels = Array.from(names, (name) => ({
          id: crypto.randomUUID(),
          user_id: this.userId,
          name,
          color:
            DEFAULT_LABELS.find((label) => label.name === name)?.color ||
            "#718bb4",
          created_at: new Date().toISOString(),
        }));
      }
      if (
        !["tasks", "members", "comments", "activities", "labels"].every((key) =>
          Array.isArray(state[key as keyof Snapshot]),
        )
      )
        throw new Error();
      if (
        [
          ...state.tasks,
          ...state.members,
          ...state.comments,
          ...state.activities,
          ...state.labels,
        ].some((row) => row.user_id !== this.userId)
      )
        throw new Error();
      return state;
    } catch {
      throw new Error(
        "Saved workspace data could not be read. Your existing data has not been overwritten. Restore a valid backup or clear this site’s data to start again.",
      );
    }
  }
  private write(state: Snapshot) {
    localStorage.setItem(this.key, JSON.stringify(state));
  }
  private activity(state: Snapshot, taskId: string, message: string) {
    state.activities.push({
      id: crypto.randomUUID(),
      user_id: this.userId,
      task_id: taskId,
      message,
      created_at: new Date().toISOString(),
    });
  }
  async load() {
    return this.read();
  }
  async createTask(input: TaskInput) {
    const state = this.read();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    state.tasks.push({
      ...input,
      id,
      user_id: this.userId,
      created_at: now,
      updated_at: now,
    });
    this.activity(state, id, "Created this task");
    this.write(state);
  }
  async updateTask(id: string, input: TaskInput) {
    const state = this.read();
    const task = state.tasks.find((task) => task.id === id);
    if (!task)
      throw new Error("This task no longer exists. Refresh your board.");
    const messages = taskChanges(task, input, state.members);
    if (!messages.length) return;
    Object.assign(task, input, { updated_at: new Date().toISOString() });
    for (const message of messages) this.activity(state, id, message);
    this.write(state);
  }
  async deleteTask(id: string) {
    const state = this.read();
    state.tasks = state.tasks.filter((task) => task.id !== id);
    state.comments = state.comments.filter((comment) => comment.task_id !== id);
    state.activities = state.activities.filter(
      (activity) => activity.task_id !== id,
    );
    this.write(state);
  }
  async addMember(name: string, color: string) {
    const state = this.read();
    state.members.push({
      id: crypto.randomUUID(),
      user_id: this.userId,
      name,
      color,
      created_at: new Date().toISOString(),
    });
    this.write(state);
  }
  async addComment(taskId: string, body: string) {
    const state = this.read();
    if (!state.tasks.some((task) => task.id === taskId))
      throw new Error("This task no longer exists.");
    state.comments.push({
      id: crypto.randomUUID(),
      user_id: this.userId,
      task_id: taskId,
      body,
      created_at: new Date().toISOString(),
    });
    this.write(state);
  }
  async addLabel(name: string, color: string) {
    const state = this.read();
    const clean = name.trim();
    if (!clean || clean.length > 32)
      throw new Error("Use a label name between 1 and 32 characters.");
    if (!/^#[0-9a-f]{6}$/i.test(color))
      throw new Error("Choose a valid label color.");
    if (
      state.labels.some(
        (label) => label.name.toLocaleLowerCase() === clean.toLocaleLowerCase(),
      )
    )
      throw new Error("A label with this name already exists.");
    state.labels.push({
      id: crypto.randomUUID(),
      user_id: this.userId,
      name: clean,
      color,
      created_at: new Date().toISOString(),
    });
    this.write(state);
  }
}

export class SupabaseRepository implements BoardRepository {
  mode = "supabase" as const;
  private labelsInitialization: Promise<void> | null = null;
  constructor(
    private client: SupabaseClient,
    public userId: string,
  ) {}
  private async readLabelNames() {
    const { data, error } = await this.client
      .from("labels")
      .select("name")
      .eq("user_id", this.userId);
    if (error) throw error;
    return new Set((data ?? []).map((label) => label.name.toLowerCase()));
  }
  private async initializeLabels() {
    let existing = await this.readLabelNames();
    for (const label of DEFAULT_LABELS) {
      if (existing.has(label.name.toLowerCase())) continue;
      const { error } = await this.client
        .from("labels")
        .insert({ ...label, user_id: this.userId });
      if (error) {
        // Another tab may have inserted this label after our initial read.
        // Only accept a duplicate after confirming that this owner has it.
        if (error.code !== "23505") throw error;
        existing = await this.readLabelNames();
        if (!existing.has(label.name.toLowerCase())) throw error;
      }
    }
  }
  async load(): Promise<Snapshot> {
    // StrictMode and simultaneous refreshes share one initialization attempt.
    this.labelsInitialization ??= this.initializeLabels().catch((error) => {
      this.labelsInitialization = null;
      throw error;
    });
    await this.labelsInitialization;
    const tables = [
      "tasks",
      "team_members",
      "comments",
      "task_activities",
      "labels",
    ] as const;
    const results = await Promise.all(
      tables.map((table) =>
        this.client
          .from(table)
          .select("*")
          .eq("user_id", this.userId)
          .order("created_at"),
      ),
    );
    for (const result of results) if (result.error) throw result.error;
    return {
      tasks: results[0].data ?? [],
      members: results[1].data ?? [],
      comments: results[2].data ?? [],
      activities: results[3].data ?? [],
      labels: results[4].data ?? [],
    } as Snapshot;
  }
  async createTask(input: TaskInput) {
    const { error } = await this.client
      .from("tasks")
      .insert({ ...input, user_id: this.userId });
    if (error) throw error;
  }
  async updateTask(id: string, input: TaskInput) {
    const { data, error } = await this.client
      .from("tasks")
      .update(input)
      .eq("id", id)
      .eq("user_id", this.userId)
      .select("id")
      .single();
    if (error || !data)
      throw error || new Error("Task no longer exists. Refresh your board.");
  }
  async deleteTask(id: string) {
    const { data, error } = await this.client
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("user_id", this.userId)
      .select("id")
      .single();
    if (error || !data)
      throw error || new Error("Task no longer exists. Refresh your board.");
  }
  async addMember(name: string, color: string) {
    const { error } = await this.client
      .from("team_members")
      .insert({ name, color, user_id: this.userId });
    if (error) throw error;
  }
  async addComment(taskId: string, body: string) {
    const { error } = await this.client
      .from("comments")
      .insert({ task_id: taskId, body, user_id: this.userId });
    if (error) throw error;
  }
  async addLabel(name: string, color: string) {
    const { error } = await this.client
      .from("labels")
      .insert({ name: name.trim(), color, user_id: this.userId });
    if (error?.code === "23505")
      throw new Error("A label with this name already exists.");
    if (error) throw error;
  }
}

let initialization: Promise<BoardRepository> | null = null;
export function initializeRepository(): Promise<BoardRepository> {
  if (initialization) return initialization;
  initialization = (async () => {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim();
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
    if (!url && !key) return new LocalRepository();
    if (!url || !key)
      throw new Error(
        "Supabase configuration is incomplete. Set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or leave both empty for local demo mode.",
      );
    if (key.startsWith("sb_secret_"))
      throw new Error(
        "Use a Supabase publishable/anon key. A secret key must never be used in the frontend.",
      );
    // Reject legacy service-role JWTs as well as the new secret-key format.
    if (key.split(".").length === 3) {
      try {
        const payload = JSON.parse(
          atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        );
        if (payload.role === "service_role")
          throw new Error(
            "A service-role key cannot be used in the frontend. Use the public anon key.",
          );
      } catch (error) {
        if (error instanceof Error && error.message.includes("service-role"))
          throw error;
      }
    }
    const client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();
    if (sessionError) throw sessionError;
    let userId = sessionData.session?.user.id;
    if (!userId) {
      const { data, error } = await client.auth.signInAnonymously();
      if (error) throw error;
      userId = data.user?.id;
    }
    if (!userId)
      throw new Error("Could not create your guest session. Please retry.");
    return new SupabaseRepository(client, userId);
  })();
  initialization.catch(() => {
    initialization = null;
  });
  return initialization;
}
export { emptySnapshot };
