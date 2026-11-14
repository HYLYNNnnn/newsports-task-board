import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error(
    "Supabase is not configured. Set both public environment variables in .env before running this test.",
  );
  process.exit(1);
}
if (
  key.startsWith("sb_secret_") ||
  (key.split(".").length === 3 &&
    JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role ===
      "service_role")
) {
  throw new Error(
    "Refusing to test RLS with a privileged key. Use a publishable/anon key.",
  );
}
const makeClient = () =>
  createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
const a = makeClient();
const b = makeClient();
let taskId;
let memberId;
let labelId;
const customLabel = `RLS-${crypto.randomUUID().slice(0, 8)}`;
try {
  const authA = await a.auth.signInAnonymously();
  if (authA.error) throw authA.error;
  const authB = await b.auth.signInAnonymously();
  if (authB.error) throw authB.error;
  const userA = authA.data.user.id;
  const userB = authB.data.user.id;
  assert.notEqual(userA, userB);
  const label = await a
    .from("labels")
    .insert({ user_id: userA, name: customLabel, color: "#718bb4" })
    .select()
    .single();
  if (label.error) throw label.error;
  labelId = label.data.id;
  const invisibleLabel = await b.from("labels").select("*").eq("id", labelId);
  assert.ifError(invisibleLabel.error);
  assert.equal(invisibleLabel.data.length, 0);
  const crossLabel = await b.from("tasks").insert({
    user_id: userB,
    title: "Cross-user label",
    labels: [customLabel],
  });
  assert.ok(crossLabel.error);
  const member = await a
    .from("team_members")
    .insert({ user_id: userA, name: "RLS test member", color: "#dbe7e4" })
    .select()
    .single();
  if (member.error) throw member.error;
  memberId = member.data.id;
  const task = await a
    .from("tasks")
    .insert({
      user_id: userA,
      title: "Temporary RLS smoke test",
      assignee_id: memberId,
      labels: [customLabel],
    })
    .select()
    .single();
  if (task.error) throw task.error;
  taskId = task.data.id;
  const invisible = await b.from("tasks").select("*").eq("id", taskId);
  assert.ifError(invisible.error);
  assert.equal(invisible.data.length, 0);
  const cannotUpdate = await b
    .from("tasks")
    .update({ title: "Tampered" })
    .eq("id", taskId)
    .select();
  assert.ifError(cannotUpdate.error);
  assert.equal(cannotUpdate.data.length, 0);
  const cannotDelete = await b.from("tasks").delete().eq("id", taskId).select();
  assert.ifError(cannotDelete.error);
  assert.equal(cannotDelete.data.length, 0);
  const forgedOwner = await b
    .from("tasks")
    .insert({ user_id: userA, title: "Forged owner" });
  assert.ok(forgedOwner.error);
  const crossComment = await b
    .from("comments")
    .insert({ user_id: userB, task_id: taskId, body: "Cross-user comment" });
  assert.ok(crossComment.error);
  const crossMember = await b.from("tasks").insert({
    user_id: userB,
    title: "Cross-user member",
    assignee_id: memberId,
  });
  assert.ok(crossMember.error);
  const cannotReassign = await a
    .from("tasks")
    .update({ user_id: userB })
    .eq("id", taskId);
  assert.ok(cannotReassign.error);
  const fakeActivity = await a
    .from("task_activities")
    .insert({ user_id: userA, task_id: taskId, message: "Forged event" });
  assert.ok(fakeActivity.error);
  const ownComment = await a
    .from("comments")
    .insert({ user_id: userA, task_id: taskId, body: "Own comment" });
  assert.ifError(ownComment.error);
  const update = await a
    .from("tasks")
    .update({ status: "done" })
    .eq("id", taskId)
    .select()
    .single();
  assert.ifError(update.error);
  assert.equal(update.data.status, "done");
  const events = await a
    .from("task_activities")
    .select("*")
    .eq("task_id", taskId);
  assert.ifError(events.error);
  assert.equal(events.data.length, 2);
  const deleted = await a.from("tasks").delete().eq("id", taskId);
  assert.ifError(deleted.error);
  const comments = await a.from("comments").select("*").eq("task_id", taskId);
  assert.ifError(comments.error);
  assert.equal(comments.data.length, 0);
  const activities = await a
    .from("task_activities")
    .select("*")
    .eq("task_id", taskId);
  assert.ifError(activities.error);
  assert.equal(activities.data.length, 0);
  console.log(
    "PASS: two guest identities, task and label isolation, ownership checks, cross-user reference protection, activity trigger, and cascading delete.",
  );
} finally {
  if (taskId) await a.from("tasks").delete().eq("id", taskId);
  if (memberId) await a.from("team_members").delete().eq("id", memberId);
  await Promise.all([a.auth.signOut(), b.auth.signOut()]);
}
