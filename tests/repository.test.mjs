import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  logLevel: "silent",
  server: { middlewareMode: true, hmr: false, watch: null },
});
after(() => server.close());
const { SupabaseRepository } = await server.ssrLoadModule(
  "/src/lib/repository.ts",
);
const { DEFAULT_LABELS } = await server.ssrLoadModule("/src/types.ts");
const owner = "00000000-0000-4000-8000-000000000001";

function workspace({ labels = [], beforeInsert, readError } = {}) {
  const rows = labels.map((label) => ({ ...label, user_id: owner }));
  const inserts = [];
  const response = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const client = createClient("https://test.supabase.co", "test-public-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, options) => {
        const url = new URL(input);
        if (options.method === "GET")
          assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
        if (url.pathname !== "/rest/v1/labels") return response([]);
        if (options.method === "GET") {
          const error = readError?.();
          return error ? response(error, 403) : response(rows);
        }
        assert.equal(options.method, "POST");
        const row = JSON.parse(options.body);
        assert.equal(row.user_id, owner);
        // Inserts carry ownership in their body rather than a query filter.
        inserts.push(row);
        const error = await beforeInsert?.(row, rows);
        if (error) return response(error, error.code === "23505" ? 409 : 403);
        if (
          rows.some(
            (existing) =>
              existing.user_id === row.user_id &&
              existing.name.toLowerCase() === row.name.toLowerCase(),
          )
        )
          return response(
            {
              code: "23505",
              message:
                'duplicate key value violates unique constraint "labels_owner_name_ci_idx"',
            },
            409,
          );
        rows.push(row);
        return new Response(null, { status: 201 });
      },
    },
  });
  return { repo: new SupabaseRepository(client, owner), rows, inserts };
}

test("existing labels, including different casing and custom colors, are retained", async () => {
  const labels = DEFAULT_LABELS.map((label) => ({
    ...label,
    name: label.name.toLowerCase(),
    color: "#123456",
  }));
  const { repo, inserts } = workspace({ labels });
  const snapshot = await repo.load();
  assert.equal(inserts.length, 0);
  assert.deepEqual(
    snapshot.labels.map(({ name, color }) => ({ name, color })),
    labels,
  );
});

test("simultaneous initial loads seed each missing default only once", async () => {
  const { repo, rows, inserts } = workspace({ labels: [DEFAULT_LABELS[0]] });
  await Promise.all([repo.load(), repo.load(), repo.load()]);
  assert.equal(inserts.length, 4);
  assert.equal(rows.length, 5);
  await repo.load();
  assert.equal(inserts.length, 4);
});

test("a competing tab can create defaults between the read and insert", async () => {
  let competed = false;
  const { repo, rows } = workspace({
    beforeInsert: (_, existing) => {
      if (!competed) {
        competed = true;
        existing.push(
          ...DEFAULT_LABELS.map((label) => ({ ...label, user_id: owner })),
        );
      }
    },
  });
  const snapshot = await repo.load();
  assert.equal(snapshot.labels.length, 5);
  assert.equal(rows.length, 5);
});

test("unrelated unique violations remain visible, and initialization can retry", async () => {
  let fail = true;
  const { repo, rows } = workspace({
    beforeInsert: () =>
      fail
        ? { code: "23505", message: "Unrelated unique constraint" }
        : undefined,
  });
  await assert.rejects(repo.load(), { code: "23505" });
  assert.equal(rows.length, 0);
  fail = false;
  assert.equal((await repo.load()).labels.length, 5);
});

test("label read permissions and insert permissions are not silently ignored", async () => {
  const denied = { code: "42501", message: "Permission denied" };
  const read = workspace({ readError: () => denied });
  await assert.rejects(read.repo.load(), { code: "42501" });
  assert.equal(read.inserts.length, 0);
  const insert = workspace({ beforeInsert: () => denied });
  await assert.rejects(insert.repo.load(), { code: "42501" });
  assert.equal(insert.rows.length, 0);
});
