import { test, expect, type Page } from "@playwright/test";

async function createTask(page: Page, title: string) {
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByRole("textbox", { name: "Task title" }).fill(title);
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Open task: ${title}`, exact: true }),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("task-card")).toHaveCount(10);
});

test("task details, due dates, comments, activity, reload persistence, and cascading delete", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create task", exact: true }),
  ).toBeDisabled();
  await page.getByRole("textbox", { name: "Task title" }).fill("E2E Task");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("A complete task lifecycle.");
  await page
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("high");
  await page
    .getByRole("textbox", { name: "Due date", exact: true })
    .fill("2020-01-01");
  await page
    .getByRole("combobox", { name: "Assignee", exact: true })
    .selectOption({ label: "Alex Morgan" });
  await page.getByRole("button", { name: "Engineering", exact: true }).click();
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  const card = page.getByRole("button", {
    name: "Open task: E2E Task",
    exact: true,
  });
  await expect(card.locator(".overdue")).toContainText("Jan 1");
  await card.dblclick();
  await expect(
    page.getByRole("textbox", { name: "Description", exact: true }),
  ).toHaveValue("A complete task lifecycle.");
  await page
    .getByRole("textbox", { name: "Write a comment" })
    .fill("Lifecycle comment");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(
    page.getByText("Lifecycle comment", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("in_review");
  await page
    .getByRole("textbox", { name: "Task title" })
    .fill("E2E Task updated");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.reload();
  const updated = page
    .getByTestId("column-in_review")
    .getByRole("button", { name: "Open task: E2E Task updated", exact: true });
  await updated.dblclick();
  await expect(
    page.getByRole("textbox", { name: "Due date", exact: true }),
  ).toHaveValue("2020-01-01");
  await expect(
    page.getByText("Lifecycle comment", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Activity/ }).click();
  await expect(
    page.getByText("Moved from To Do → In Review", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await page.getByRole("button", { name: "Keep task", exact: true }).click();
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByTestId("task-card")).toHaveCount(10);
  const board = await page.evaluate(() => {
    const id = localStorage.getItem("nextplay.guest.v1");
    return JSON.parse(localStorage.getItem(`nextplay.board.v1.${id}`)!);
  });
  expect(
    board.comments.some(
      (comment: { body: string }) => comment.body === "Lifecycle comment",
    ),
  ).toBe(false);
});

test("actual pointer drag between columns persists after reload", async ({
  page,
}) => {
  const source = page.getByRole("button", {
    name: "Open task: Explore onboarding concepts",
    exact: true,
  });
  const sourceBox = await source.boundingBox();
  const destinationBox = await page.getByTestId("column-done").boundingBox();
  if (!sourceBox || !destinationBox) throw new Error("Missing drag geometry");
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + 60);
  await page.mouse.down();
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 12,
    sourceBox.y + 60,
    { steps: 4 },
  );
  await page.mouse.move(
    destinationBox.x + destinationBox.width / 2,
    destinationBox.y + 180,
    { steps: 25 },
  );
  await expect(page.getByTestId("drag-preview")).toBeVisible();
  await expect(page.getByTestId("column-done")).toHaveClass(/column-over/);
  const placeholder = await source.boundingBox();
  expect(Math.abs(placeholder!.x - sourceBox.x)).toBeLessThan(5);
  expect(Math.abs(placeholder!.y - sourceBox.y)).toBeLessThan(8);
  if (process.env.NEXTPLAY_CAPTURE_PREVIEW === "1") {
    await page.screenshot({
      path: "output/colorful-drag-preview.png",
      fullPage: false,
      animations: "disabled",
    });
  }
  await page.mouse.up();
  await expect(page.getByTestId("drag-preview")).toHaveCount(0);
  await expect(
    page.getByTestId("column-done").getByRole("button", {
      name: "Open task: Explore onboarding concepts",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByTestId("column-done").getByRole("button", {
      name: "Open task: Explore onboarding concepts",
      exact: true,
    }),
  ).toBeVisible();
});

test("cancelling a drag restores the card without changing its status", async ({
  page,
}) => {
  const source = page.getByRole("button", {
    name: "Open task: Explore onboarding concepts",
    exact: true,
  });
  const start = (await source.boundingBox())!;
  const destination = (await page
    .getByTestId("column-in_progress")
    .boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + 55);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 15, start.y + 55, {
    steps: 4,
  });
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + 100,
    { steps: 15 },
  );
  await expect(page.getByTestId("drag-preview")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.getByTestId("drag-preview")).toHaveCount(0);
  await expect(
    page.getByTestId("column-todo").getByRole("button", {
      name: "Open task: Explore onboarding concepts",
      exact: true,
    }),
  ).toHaveCSS("opacity", "1");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByTestId("column-todo").getByRole("button", {
      name: "Open task: Explore onboarding concepts",
      exact: true,
    }),
  ).toBeVisible();
});

test("reduced motion keeps drag and drop usable without lift or landing motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const source = page.getByRole("button", {
    name: "Open task: Explore onboarding concepts",
    exact: true,
  });
  const start = (await source.boundingBox())!;
  const destination = (await page
    .getByTestId("column-in_progress")
    .boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + 55);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 15, start.y + 55, {
    steps: 4,
  });
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + 100,
    { steps: 15 },
  );
  await expect(page.getByTestId("drag-preview")).toHaveCSS("transform", "none");
  await page.mouse.up();
  await expect(page.getByTestId("drag-preview")).toHaveCount(0);
  await expect(
    page.getByTestId("column-in_progress").getByRole("button", {
      name: "Open task: Explore onboarding concepts",
      exact: true,
    }),
  ).toHaveCSS("opacity", "1");
});

test("search, combined filters, clear filters, list view, and overview", async ({
  page,
}) => {
  await page.getByRole("textbox", { name: "Search tasks" }).fill("onboarding");
  await expect(page.getByTestId("task-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Filter by priority" })
    .selectOption("high");
  await page
    .getByRole("combobox", { name: "Filter by label" })
    .selectOption("Design");
  await expect(page.getByTestId("task-card")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Search tasks" })
    .fill("no-such-task");
  await expect(
    page.getByText("No tasks match your filters.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page.getByTestId("task-card")).toHaveCount(10);
  await page.getByRole("tab", { name: "List", exact: true }).click();
  await expect(page.locator(".list-row")).toHaveCount(10);
  await page
    .getByRole("combobox", { name: "Sort tasks" })
    .selectOption("title");
  await expect(page.locator(".list-task-title strong").first()).toHaveText(
    "Build the game discovery page",
  );
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.getByText("20% complete", { exact: true })).toBeVisible();
});

test("add a teammate and assign a task", async ({ page }) => {
  await page.getByRole("button", { name: "Add teammate", exact: true }).click();
  await page.getByRole("textbox", { name: "Name" }).fill("Taylor Kim");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add teammate", exact: true })
    .click();
  await createTask(page, "Assigned task");
  await page
    .getByRole("button", { name: "Open task: Assigned task", exact: true })
    .dblclick();
  await page
    .getByRole("combobox", { name: "Assignee", exact: true })
    .selectOption({ label: "Taylor Kim" });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: /Team members 4/ }).click();
  await expect(
    page.getByRole("heading", { name: "Taylor Kim", exact: true }),
  ).toBeVisible();
});

test("different browser sessions have isolated local demo data", async ({
  page,
  browser,
}) => {
  await createTask(page, "Only guest A can see this");
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/");
  await expect(otherPage.getByTestId("task-card")).toHaveCount(10);
  await expect(
    otherPage.getByText("Only guest A can see this", { exact: true }),
  ).toHaveCount(0);
  await other.close();
});

test("mobile layout, navigation, form, and no page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Team members 3" }).click();
  await expect(
    page.getByRole("heading", { name: "Better, together." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Task board 10" }).click();
  await createTask(page, "Mobile task");
  await page
    .getByRole("button", { name: "Open task: Mobile task", exact: true })
    .dblclick();
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeInViewport();
});

test("storage failures show an error and never report success", async ({
  page,
}) => {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith("nextplay.board.v1."))
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Task title" })
    .fill("Will not be saved");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Browser storage is unavailable or full",
  );
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByTestId("task-card")).toHaveCount(10);
});

test("corrupt saved data is reported without being overwritten", async ({
  page,
}) => {
  await page.evaluate(() => {
    const id = localStorage.getItem("nextplay.guest.v1");
    localStorage.setItem(`nextplay.board.v1.${id}`, "{broken-json");
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Saved workspace data could not be read",
  );
  const raw = await page.evaluate(() =>
    localStorage.getItem(
      `nextplay.board.v1.${localStorage.getItem("nextplay.guest.v1")}`,
    ),
  );
  expect(raw).toBe("{broken-json");
});

test("custom labels keep their colors, support multiple selections and filter after reload", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Manage labels" }).click();
  await page.getByRole("textbox", { name: "New label name" }).fill("Feature");
  await page
    .getByRole("button", { name: "Label color #358c96", exact: true })
    .click();
  await page.getByRole("button", { name: "Create label", exact: true }).click();
  await expect(
    page.locator(".workspace-label-row").filter({ hasText: "Feature" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "New label name" }).fill("feature");
  await expect(
    page.getByText("A label with this name already exists.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create label", exact: true }),
  ).toBeDisabled();
  // A label named "all" must remain selectable rather than resetting the filter.
  await page.getByRole("textbox", { name: "New label name" }).fill("all");
  await page.getByRole("button", { name: "Create label", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await createTask(page, "Custom label task");
  await page
    .getByRole("button", { name: "Open task: Custom label task", exact: true })
    .dblclick();
  for (const name of ["Feature", "Design", "all"])
    await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.reload();
  const card = page.getByRole("button", {
    name: "Open task: Custom label task",
    exact: true,
  });
  await expect(card.locator(".tag")).toHaveText(["Feature", "Design", "all"]);
  await expect(card.getByText("Feature", { exact: true })).toHaveCSS(
    "background-color",
    "rgb(53, 140, 150)",
  );
  if (process.env.NEXTPLAY_CAPTURE_PREVIEW === "1") {
    await page.screenshot({
      path: "output/colorful-board-preview.png",
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Filter by label" })
    .selectOption("all");
  await expect(page.getByTestId("task-card")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Filter by label" })
    .selectOption("Feature");
  await expect(page.getByTestId("task-card")).toHaveCount(1);
});

test("creating a label inside task details preserves the draft and comments have ordered timestamps", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByRole("textbox", { name: "Task title" }).fill("Keep my draft");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Keep this context too.");
  await page.getByRole("button", { name: "New label", exact: true }).click();
  await page.getByRole("textbox", { name: "New label name" }).fill("Feedback");
  await page.getByRole("textbox", { name: "New label name" }).press("Enter");
  await expect(
    page.getByRole("button", { name: "Feedback", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue(
    "Keep my draft",
  );
  await expect(page.getByTestId("task-card")).toHaveCount(10);
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page
    .getByRole("button", { name: "Open task: Keep my draft", exact: true })
    .dblclick();
  await expect(
    page.getByRole("textbox", { name: "Description", exact: true }),
  ).toHaveValue("Keep this context too.");
  for (const comment of ["First comment", "Second comment"]) {
    await page.getByRole("textbox", { name: "Write a comment" }).fill(comment);
    await page
      .getByRole("button", { name: "Post comment", exact: true })
      .click();
    await expect(page.getByText(comment, { exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Open task: Keep my draft", exact: true })
    .dblclick();
  await expect(page.locator(".comment p")).toHaveText([
    "First comment",
    "Second comment",
  ]);
  const times = await page
    .locator(".comment time")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("datetime")),
    );
  expect(times.every((time) => !!time && !Number.isNaN(Date.parse(time)))).toBe(
    true,
  );
  expect(Date.parse(times[0]!)).toBeLessThanOrEqual(Date.parse(times[1]!));
});

test("timeline describes individual changes and ignores an unchanged save", async ({
  page,
}) => {
  await page
    .getByRole("button", {
      name: "Open task: Explore onboarding concepts",
      exact: true,
    })
    .dblclick();
  await page
    .getByRole("textbox", { name: "Task title" })
    .fill("Updated onboarding");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Updated context");
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("in_review");
  await page
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("low");
  await page
    .getByRole("combobox", { name: "Assignee", exact: true })
    .selectOption({ label: "Alex Morgan" });
  await page
    .getByRole("textbox", { name: "Due date", exact: true })
    .fill("2050-01-02");
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await page.getByRole("button", { name: "Engineering", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByRole("button", { name: "Open task: Updated onboarding", exact: true })
    .dblclick();
  await page.getByRole("button", { name: /^Activity/ }).click();
  for (const text of [
    "Renamed task from “Explore onboarding concepts” to “Updated onboarding”",
    "Updated the description",
    "Moved from To Do → In Review",
    "Changed priority from High → Low",
    "Set due date to 2050-01-02",
    "Reassigned from Jamie Park → Alex Morgan",
    "Added label “Engineering”",
    "Removed label “Design”",
  ])
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  const count = await page.locator(".activity").count();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByRole("button", { name: "Open task: Updated onboarding", exact: true })
    .dblclick();
  await page.getByRole("button", { name: /^Activity/ }).click();
  await expect(page.locator(".activity")).toHaveCount(count);
});

test("due badges distinguish today, tomorrow, three days, overdue and completed tasks", async ({
  page,
}) => {
  const dates = await page.evaluate(() =>
    [-1, 0, 1, 3, 4].map((offset) => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }),
  );
  for (const [index, title, status] of [
    [0, "Overdue badge", "todo"],
    [1, "Today badge", "todo"],
    [2, "Tomorrow badge", "todo"],
    [3, "Soon badge", "todo"],
    [4, "Later badge", "todo"],
    [0, "Completed badge", "done"],
  ] as const) {
    await page.getByRole("button", { name: "New task", exact: true }).click();
    await page.getByRole("textbox", { name: "Task title" }).fill(title);
    await page
      .getByRole("textbox", { name: "Due date", exact: true })
      .fill(dates[index]);
    await page
      .getByRole("combobox", { name: "Status", exact: true })
      .selectOption(status);
    await page
      .getByRole("button", { name: "Create task", exact: true })
      .click();
    const card = page.getByRole("button", {
      name: `Open task: ${title}`,
      exact: true,
    });
    if (title === "Overdue badge")
      await expect(card.locator(".overdue")).toBeVisible();
    else if (title === "Today badge")
      await expect(card.locator(".due-soon")).toHaveText("Today");
    else if (title === "Tomorrow badge")
      await expect(card.locator(".due-soon")).toHaveText("Tomorrow");
    else if (title === "Soon badge")
      await expect(card.locator(".due-soon")).toHaveText("In 3 days");
    else await expect(card.locator(".overdue, .due-soon")).toHaveCount(0);
  }
});

test("upgrading a previous local board preserves its tasks and comments", async ({
  page,
}) => {
  const previousIds = await page.evaluate(() => {
    const key = `nextplay.board.v1.${localStorage.getItem("nextplay.guest.v1")}`;
    const board = JSON.parse(localStorage.getItem(key)!);
    delete board.labels;
    localStorage.setItem(key, JSON.stringify(board));
    return board.tasks.map((task: { id: string }) => task.id);
  });
  await page.reload();
  await expect(page.getByTestId("task-card")).toHaveCount(10);
  await page.getByRole("button", { name: "Manage labels" }).click();
  await expect(page.locator(".workspace-label-row")).toHaveCount(5);
  await page
    .getByRole("textbox", { name: "New label name" })
    .fill("Migrated label");
  await page.getByRole("button", { name: "Create label", exact: true }).click();
  await expect(page.locator(".workspace-label-row")).toHaveCount(6);
  const board = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem(
        `nextplay.board.v1.${localStorage.getItem("nextplay.guest.v1")}`,
      )!,
    ),
  );
  expect(board.tasks.map((task: { id: string }) => task.id)).toEqual(
    previousIds,
  );
  expect(board.comments).toHaveLength(1);
  expect(board.activities).toHaveLength(10);
  expect(
    board.labels.some(
      (label: { name: string }) => label.name === "Migrated label",
    ),
  ).toBe(true);
});

test("single click expands complete information and comments without entering edit mode", async ({
  page,
}) => {
  const title = "Review player profile screens";
  const summary = page.getByRole("button", {
    name: `Open task: ${title}`,
    exact: true,
  });
  await summary.click();
  const details = page.getByRole("region", {
    name: `Details: ${title}`,
    exact: true,
  });
  await expect(details).toBeVisible();
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await expect(details.locator(".readout-description p")).toHaveText(
    "Give the new profile flow a final look. Check empty states, accessibility, and the mobile layout.",
  );
  await expect(details.getByText("Jamie Park", { exact: true })).toBeVisible();
  await expect(details.getByText("In Review", { exact: true })).toBeVisible();
  await expect(
    details.getByText(
      "The new direction looks great. Let’s double-check the empty state before we ship.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveCount(
    0,
  );
  if (process.env.NEXTPLAY_CAPTURE_PREVIEW === "1")
    await page.screenshot({
      path: "output/task-reading-preview.png",
      fullPage: true,
      animations: "disabled",
    });
  await summary.click();
  await expect(details).toHaveCount(0);
  await expect(summary).toHaveAttribute("aria-expanded", "false");
});

test("comment icon opens an independent panel and refreshes the count without toggling the card", async ({
  page,
}) => {
  const title = "Review player profile screens";
  const summary = page.getByRole("button", {
    name: `Open task: ${title}`,
    exact: true,
  });
  await summary.click();
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("button", { name: `Open comments: ${title}`, exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Comments", exact: true });
  await expect(panel).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Write a comment" }),
  ).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveCount(
    0,
  );
  await expect(panel.getByRole("combobox")).toHaveCount(0);
  await panel
    .getByRole("textbox", { name: "Write a comment" })
    .fill("A standalone conversation.");
  await panel
    .getByRole("button", { name: "Post comment", exact: true })
    .click();
  await expect(
    panel.getByText("A standalone conversation.", { exact: true }),
  ).toBeVisible();
  if (process.env.NEXTPLAY_CAPTURE_PREVIEW === "1")
    await page.screenshot({
      path: "output/comments-panel-preview.png",
      fullPage: false,
      animations: "disabled",
    });
  await panel.getByRole("button", { name: "Done", exact: true }).click();
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("button", { name: `Open comments: ${title}`, exact: true }),
  ).toHaveText("2");
  await expect(
    page
      .getByRole("region", { name: `Details: ${title}`, exact: true })
      .getByText("A standalone conversation.", { exact: true }),
  ).toBeVisible();
});

test("double click and the pencil open the editor without a delayed expansion", async ({
  page,
}) => {
  await page.clock.install();
  const title = "Explore onboarding concepts";
  const summary = page.getByRole("button", {
    name: `Open task: ${title}`,
    exact: true,
  });
  await summary.dblclick();
  await expect(
    page.getByRole("dialog", { name: "Edit task", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(500);
  await expect(page.locator(".task-expanded-panel")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Task title" })
    .fill("An edited title");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit task: An edited title", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue(
    "An edited title",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.clock.fastForward(500);
  await expect(page.locator(".task-expanded-panel")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("list view opens a read-only overview and keeps editing explicit", async ({
  page,
}) => {
  const title = "Explore onboarding concepts";
  await page.getByRole("tab", { name: "List", exact: true }).click();
  await page
    .getByRole("button", { name: `Open task: ${title}`, exact: true })
    .click();
  const overview = page.getByRole("dialog", { name: title, exact: true });
  await expect(overview).toBeVisible();
  await expect(
    overview.getByRole("textbox", { name: "Task title" }),
  ).toHaveCount(0);
  await expect(overview.locator(".readout-description p")).toContainText(
    "Map out a welcoming first-run experience.",
  );
  await overview
    .getByRole("button", { name: `Edit task: ${title}`, exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue(
    title,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: `Open task: ${title}`, exact: true })
    .dblclick();
  await expect(
    page.getByRole("dialog", { name: "Edit task", exact: true }),
  ).toBeVisible();
});

test("keyboard expansion and comment input do not activate dragging", async ({
  page,
}) => {
  const title = "Explore onboarding concepts";
  const summary = page.getByRole("button", {
    name: `Open task: ${title}`,
    exact: true,
  });
  await expect(
    page.getByRole("button", { name: `Open comments: ${title}`, exact: true }),
  ).toHaveCount(0);
  await summary.press("Enter");
  const details = page.getByRole("region", {
    name: `Details: ${title}`,
    exact: true,
  });
  await expect(details).toBeVisible();
  const input = details.getByRole("textbox", { name: "Write a comment" });
  await input.fill("Keyboard");
  await input.press("Space");
  await input.press("k");
  await expect(input).toHaveValue("Keyboard k");
  await expect(page.getByTestId("drag-preview")).toHaveCount(0);
  await input.press("Enter");
  await expect(details.getByText("Keyboard k", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Open comments: ${title}`, exact: true }),
  ).toHaveText("1");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("mobile card reading and its separate comment panel stay usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const title = "Review player profile screens";
  await page
    .getByRole("button", { name: `Open task: ${title}`, exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: `Details: ${title}`, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
  await page
    .getByRole("button", { name: `Open comments: ${title}`, exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Comments", exact: true });
  await expect(panel).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Post comment", exact: true }),
  ).toBeInViewport();
  await expect(
    panel.getByRole("button", { name: "Done", exact: true }),
  ).toBeInViewport();
});
