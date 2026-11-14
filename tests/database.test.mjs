import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const schema = await readFile(
  new URL("../supabase/schema.sql", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL(
    "../supabase/migrations/20261112_advanced_features.sql",
    import.meta.url,
  ),
  "utf8",
);
const userA = "00000000-0000-4000-8000-000000000001";
const userB = "00000000-0000-4000-8000-000000000002";
async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema public, auth to authenticated, anon;
    insert into auth.users(id) values ('${userA}'), ('${userB}');
  `);
  return db;
}
async function guest(db, id, operation) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  try {
    return await operation();
  } finally {
    await db.exec("reset role");
  }
}

test("advanced SQL migration preserves an existing board and can run twice", async () => {
  const db = await setup();
  try {
    const legacy =
      schema.split("-- Custom labels and detailed activity history.")[0] +
      "commit;";
    await db.exec(legacy);
    const task = (
      await db.query(
        "insert into public.tasks(user_id,title,labels) values ($1,'Existing task',array['Design']) returning id",
        [userA],
      )
    ).rows[0];
    await db.query(
      "insert into public.comments(user_id,task_id,body) values ($1,$2,'Keep this comment')",
      [userA, task.id],
    );
    await db.exec(migration);
    await db.exec(
      "update public.labels set name='bug', color='#123456' where name='Bug'",
    );
    await db.exec(migration);
    assert.deepEqual(
      (
        await db.query(
          "select name, color from public.labels where lower(name)='bug'",
        )
      ).rows,
      [{ name: "bug", color: "#123456" }],
    );
    assert.equal(
      (await db.query("select title from public.tasks where id=$1", [task.id]))
        .rows[0].title,
      "Existing task",
    );
    assert.equal(
      (
        await db.query("select body from public.comments where task_id=$1", [
          task.id,
        ])
      ).rows[0].body,
      "Keep this comment",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as count from public.labels where user_id=$1",
          [userA],
        )
      ).rows[0].count,
      5,
    );
  } finally {
    await db.close();
  }
});

test("custom labels, detailed history, RLS, and task ownership in PostgreSQL", async (t) => {
  const db = await setup();
  let taskId;
  let memberId;
  try {
    await db.exec(schema);
    await t.test(
      "custom label names are unique per owner and cannot be read or forged by another guest",
      async () => {
        await guest(db, userA, async () => {
          await db.query(
            "insert into public.labels(user_id,name,color) values ($1,'Feature','#718bb4')",
            [userA],
          );
          await assert.rejects(
            db.query(
              "insert into public.labels(user_id,name) values ($1,'feature')",
              [userA],
            ),
            /unique constraint/i,
          );
        });
        await guest(db, userB, async () => {
          assert.equal(
            (await db.query("select * from public.labels")).rows.length,
            0,
          );
          await assert.rejects(
            db.query(
              "insert into public.labels(user_id,name) values ($1,'Forged')",
              [userA],
            ),
            /row-level security/i,
          );
          await assert.rejects(
            db.query(
              "insert into public.tasks(user_id,title,labels) values ($1,'Cross-user label',array['Feature'])",
              [userB],
            ),
            /belong to your workspace/i,
          );
        });
      },
    );
    await t.test(
      "a valid task produces distinct events for each edited field",
      async () => {
        await guest(db, userA, async () => {
          memberId = (
            await db.query(
              "insert into public.team_members(user_id,name) values ($1,'Alex Morgan') returning id",
              [userA],
            )
          ).rows[0].id;
          taskId = (
            await db.query(
              "insert into public.tasks(user_id,title,labels) values ($1,'Original title',array['Feature']) returning id",
              [userA],
            )
          ).rows[0].id;
          await db.query(
            "update public.tasks set title='Updated title', description='More context',status='in_progress', priority='high', due_date='2050-01-02',assignee_id=$1,labels='{}' where id=$2",
            [memberId, taskId],
          );
          const messages = (
            await db.query(
              "select message from public.task_activities where task_id=$1",
              [taskId],
            )
          ).rows.map((row) => row.message);
          for (const message of [
            "Created this task",
            "Renamed task from “Original title” to “Updated title”",
            "Updated the description",
            "Moved from To Do → In Progress",
            "Changed priority from Medium → High",
            "Set due date to 2050-01-02",
            "Assigned to Alex Morgan",
            "Removed label “Feature”",
          ])
            assert.ok(messages.includes(message), `Missing event: ${message}`);
          await db.query("update public.tasks set title=title where id=$1", [
            taskId,
          ]);
          assert.equal(
            (
              await db.query(
                "select count(*)::int as count from public.task_activities where task_id=$1",
                [taskId],
              )
            ).rows[0].count,
            messages.length,
          );
        });
      },
    );
    await t.test(
      "RLS and foreign keys prevent cross-user tasks, comments, assignments and forged activity",
      async () => {
        await guest(db, userB, async () => {
          assert.equal(
            (await db.query("select * from public.tasks where id=$1", [taskId]))
              .rows.length,
            0,
          );
          assert.equal(
            (
              await db.query(
                "select * from public.task_activities where task_id=$1",
                [taskId],
              )
            ).rows.length,
            0,
          );
          assert.equal(
            (
              await db.query(
                "update public.tasks set title='Tampered' where id=$1 returning id",
                [taskId],
              )
            ).rows.length,
            0,
          );
          assert.equal(
            (
              await db.query(
                "delete from public.tasks where id=$1 returning id",
                [taskId],
              )
            ).rows.length,
            0,
          );
          await assert.rejects(
            db.query(
              "insert into public.comments(user_id,task_id,body) values ($1,$2,'Cross-user comment')",
              [userB, taskId],
            ),
            /foreign key/i,
          );
          await assert.rejects(
            db.query(
              "insert into public.tasks(user_id,title,assignee_id) values ($1,'Cross-user assignee',$2)",
              [userB, memberId],
            ),
            /foreign key/i,
          );
        });
        await guest(db, userA, async () => {
          await assert.rejects(
            db.query(
              "insert into public.task_activities(user_id,task_id,message) values ($1,$2,'Fake history')",
              [userA, taskId],
            ),
            /permission denied/i,
          );
          await assert.rejects(
            db.query("update public.tasks set user_id=$1 where id=$2", [
              userB,
              taskId,
            ]),
            /row-level security/i,
          );
          await assert.rejects(
            db.query(
              "update public.tasks set labels=array['Unknown'] where id=$1",
              [taskId],
            ),
            /belong to your workspace/i,
          );
        });
      },
    );
    await t.test(
      "deleting a task removes its comments and timeline",
      async () => {
        await guest(db, userA, async () => {
          await db.query(
            "insert into public.comments(user_id,task_id,body) values ($1,$2,'Own comment')",
            [userA, taskId],
          );
          await db.query("delete from public.tasks where id=$1", [taskId]);
          assert.equal(
            (
              await db.query("select * from public.comments where task_id=$1", [
                taskId,
              ])
            ).rows.length,
            0,
          );
          assert.equal(
            (
              await db.query(
                "select * from public.task_activities where task_id=$1",
                [taskId],
              )
            ).rows.length,
            0,
          );
        });
      },
    );
  } finally {
    await db.close();
  }
});
