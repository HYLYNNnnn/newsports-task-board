import { useState } from "react";
import { Check, Plus, Tags } from "lucide-react";
import type { Snapshot, WorkspaceLabel } from "../types";
import { labelStyle } from "../lib/utils";
import { Modal } from "./Modal";
import type { RunAction } from "./TaskDialog";

const COLORS = [
  "#718bb4",
  "#9c71a4",
  "#789981",
  "#b77e7e",
  "#a19060",
  "#6675bc",
  "#358c96",
  "#b37a50",
];

export function LabelBadge({
  name,
  labels,
}: {
  name: string;
  labels: WorkspaceLabel[];
}) {
  return (
    <span className="tag" style={labelStyle(name, labels)} title={name}>
      {name}
    </span>
  );
}

export function LabelCreator({
  labels,
  busy,
  runAction,
  onCreated,
  autofocus = false,
}: {
  labels: WorkspaceLabel[];
  busy: boolean;
  runAction: RunAction;
  onCreated?: (name: string) => void;
  autofocus?: boolean;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const clean = name.trim();
  const duplicate =
    !!clean &&
    labels.some(
      (label) => label.name.toLocaleLowerCase() === clean.toLocaleLowerCase(),
    );
  async function create() {
    if (!clean || duplicate || busy) return;
    if (
      await runAction(
        (repository) => repository.addLabel(clean, color),
        `Label “${clean}” created.`,
      )
    ) {
      setName("");
      onCreated?.(clean);
    }
  }
  return (
    <div
      className="label-creator"
      role="group"
      aria-label="Create a custom label"
    >
      <div className="label-creator-heading">
        <Tags size={14} />
        <strong>Create a custom label</strong>
      </div>
      <label className="field">
        Label name
        <input
          data-autofocus={autofocus || undefined}
          aria-label="New label name"
          value={name}
          maxLength={32}
          placeholder="e.g. Feature, Feedback, Launch"
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void create();
            }
          }}
          aria-describedby={duplicate ? "duplicate-label" : undefined}
          aria-invalid={duplicate}
        />
      </label>
      {duplicate && (
        <p className="inline-error" id="duplicate-label">
          A label with this name already exists.
        </p>
      )}
      <div className="label-creator-bottom">
        <div
          className="label-color-picker"
          role="group"
          aria-label="Label color"
        >
          {COLORS.map((value) => (
            <button
              type="button"
              key={value}
              style={{ backgroundColor: value }}
              aria-label={`Label color ${value}`}
              aria-pressed={color === value}
              onClick={() => setColor(value)}
              disabled={busy}
            >
              {color === value && <Check size={12} />}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="button button-primary"
          disabled={busy || !clean || duplicate}
          onClick={() => void create()}
        >
          <Plus size={13} />
          {busy ? "Saving…" : "Create label"}
        </button>
      </div>
    </div>
  );
}

export function LabelsDialog({
  snapshot,
  busy,
  runAction,
  onClose,
}: {
  snapshot: Snapshot;
  busy: boolean;
  runAction: RunAction;
  onClose: () => void;
}) {
  return (
    <Modal
      title="A label for every kind of work."
      subtitle="Create your own labels, then mix and match them on tasks."
      onClose={onClose}
      busy={busy}
    >
      <div className="workspace-labels" aria-label="Workspace labels">
        {snapshot.labels.map((label) => {
          const count = snapshot.tasks.filter((task) =>
            task.labels.includes(label.name),
          ).length;
          return (
            <div className="workspace-label-row" key={label.id}>
              <LabelBadge name={label.name} labels={snapshot.labels} />
              <span>
                {count} {count === 1 ? "task" : "tasks"}
              </span>
            </div>
          );
        })}
      </div>
      <LabelCreator
        labels={snapshot.labels}
        busy={busy}
        runAction={runAction}
        autofocus
      />
      <p className="form-hint">
        Labels belong to your private workspace. Select several in task details,
        or filter the board by one.
      </p>
      <div className="modal-footer">
        <button
          type="button"
          className="button button-primary footer-actions"
          onClick={onClose}
          disabled={busy}
        >
          Done
          <Check size={14} />
        </button>
      </div>
    </Modal>
  );
}
