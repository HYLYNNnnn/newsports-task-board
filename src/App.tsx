import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cloud,
  Columns3,
  Flag,
  FolderKanban,
  LayoutGrid,
  List,
  LoaderCircle,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Target,
  Tags,
  Users,
  X,
} from "lucide-react";
import { Board, Avatar, StatusIcon, TaskList } from "./components/Board";
import { Modal } from "./components/Modal";
import { LabelsDialog } from "./components/Labels";
import { TaskDialog, type RunAction } from "./components/TaskDialog";
import {
  TaskCommentsDialog,
  TaskDetailsDialog,
} from "./components/TaskDetails";
import {
  emptySnapshot,
  initializeRepository,
  LOCAL_STORAGE_PREFIX,
} from "./lib/repository";
import { dueInfo, priorityTitle, readableError } from "./lib/utils";
import {
  COLUMNS,
  type BoardRepository,
  type Snapshot,
  type Status,
  type Task,
} from "./types";

type Page = "board" | "overview" | "team";
type Dialog =
  | { type: "task"; id?: string; status: Status }
  | { type: "details" | "comments"; id: string }
  | { type: "member" | "help" | "settings" | "labels" }
  | null;
const MEMBER_COLORS = [
  "#dbe7e4",
  "#e7def1",
  "#f3e1ce",
  "#dce8fa",
  "#f6dce3",
  "#e6e8ba",
];

function MemberDialog({
  busy,
  runAction,
  onClose,
}: {
  busy: boolean;
  runAction: RunAction;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(MEMBER_COLORS[0]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    if (
      await runAction(
        (repository) => repository.addMember(name.trim(), color),
        `${name.trim()} joined your workspace.`,
      )
    )
      onClose();
  }
  return (
    <Modal
      title="Great work takes a team."
      subtitle="Add a teammate to organize and assign your work."
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <div className="member-preview">
          <Avatar
            member={{ name: name || "New Teammate", color }}
            size="avatar-large"
          />
        </div>
        <label className="field">
          Name <span>*</span>
          <input
            data-autofocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Taylor Kim"
            required
            maxLength={80}
            disabled={busy}
          />
        </label>
        <div className="field">
          <span>Avatar color</span>
          <div className="color-picker">
            {MEMBER_COLORS.map((item) => (
              <button
                type="button"
                key={item}
                style={{ background: item }}
                onClick={() => setColor(item)}
                aria-label={`Choose color ${item}`}
                aria-pressed={color === item}
                disabled={busy}
              >
                {color === item && <Check size={17} />}
              </button>
            ))}
          </div>
        </div>
        <p className="form-hint">
          Team members are assignee profiles in your private workspace. They
          don’t receive invitations or access to your board.
        </p>
        <div className="modal-footer">
          <div className="footer-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              disabled={busy || !name.trim()}
            >
              {busy ? "Adding…" : "Add teammate"}
              <Plus size={15} />
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function App() {
  const [repository, setRepository] = useState<BoardRepository | null>(null);
  const repositoryRef = useRef<BoardRepository | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [page, setPage] = useState<Page>("board");
  const [view, setView] = useState<"board" | "list">("board");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [priority, setPriority] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [label, setLabel] = useState("");
  const [sort, setSort] = useState("created");
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    null,
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const initialize = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const repo = await initializeRepository();
      const data = await repo.load();
      repositoryRef.current = repo;
      setRepository(repo);
      setSnapshot(data);
      setRefreshError("");
    } catch (error) {
      setError(readableError(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  const [, tickClock] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => tickClock((value) => value + 1),
      60000,
    );
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.error ? 10000 : 4000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k" && !dialog) {
        event.preventDefault();
        setPage("board");
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [dialog]);
  useEffect(() => {
    async function sync(event: StorageEvent) {
      if (
        !event.key?.startsWith(LOCAL_STORAGE_PREFIX) ||
        repositoryRef.current?.mode !== "local" ||
        lock.current
      )
        return;
      try {
        setSnapshot(await repositoryRef.current.load());
      } catch (error) {
        setRefreshError(readableError(error));
      }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const refresh = async () => {
    if (lock.current || !repository) return;
    lock.current = true;
    setBusy(true);
    try {
      setSnapshot(await repository.load());
      setRefreshError("");
      setToast({ text: "Workspace is up to date." });
    } catch (error) {
      setRefreshError(readableError(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const runAction: RunAction = async (operation, message) => {
    if (lock.current || !repository || refreshError) return false;
    lock.current = true;
    setBusy(true);
    let committed = false;
    try {
      await operation(repository);
      committed = true;
      setSnapshot(await repository.load());
      setToast({ text: message });
      return true;
    } catch (error) {
      const text = readableError(error);
      if (committed) {
        setRefreshError(
          `Your change was saved, but the board could not refresh. ${text}`,
        );
        return true;
      }
      setToast({ text, error: true });
      try {
        setSnapshot(await repository.load());
      } catch {
        /* Retain the last known board when offline. */
      }
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  async function move(task: Task, status: Status) {
    if (lock.current) return;
    const previous = snapshotRef.current;
    setSnapshot((state) => ({
      ...state,
      tasks: state.tasks.map((item) =>
        item.id === task.id ? { ...item, status } : item,
      ),
    }));
    const input = {
      title: task.title,
      description: task.description,
      priority: task.priority,
      due_date: task.due_date,
      assignee_id: task.assignee_id,
      labels: task.labels,
      status,
    };
    if (
      !(await runAction(
        (repo) => repo.updateTask(task.id, input),
        `Moved to ${COLUMNS.find((column) => column.id === status)!.title}.`,
      ))
    )
      setSnapshot(previous);
  }
  function navigate(next: Page) {
    setPage(next);
    setMobileNav(false);
  }
  function openTask(task: Task) {
    setDialog({ type: "details", id: task.id });
  }
  function editTask(task: Task) {
    setDialog({ type: "task", id: task.id, status: task.status });
  }
  function openComments(task: Task) {
    setDialog({ type: "comments", id: task.id });
  }
  const addTask = (status: Status = "todo") =>
    setDialog({ type: "task", status });
  const clearFilters = () => {
    setSearch("");
    setPriority("all");
    setAssignee("all");
    setLabel("");
  };
  const filterCount =
    Number(priority !== "all") +
    Number(assignee !== "all") +
    Number(label !== "");
  const filtered = useMemo(
    () =>
      snapshot.tasks
        .filter((task) => {
          const matchesSearch = `${task.title} ${task.description}`
            .toLowerCase()
            .includes(search.trim().toLowerCase());
          return (
            matchesSearch &&
            (priority === "all" || task.priority === priority) &&
            (assignee === "all" ||
              (assignee === "unassigned"
                ? !task.assignee_id
                : task.assignee_id === assignee)) &&
            (!label || task.labels.some((item) => item === label))
          );
        })
        .sort((a, b) =>
          sort === "title"
            ? a.title.localeCompare(b.title)
            : sort === "due"
              ? (a.due_date || "9999").localeCompare(b.due_date || "9999")
              : new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime(),
        ),
    [snapshot.tasks, search, priority, assignee, label, sort],
  );
  const stats = {
    total: snapshot.tasks.length,
    active: snapshot.tasks.filter((task) => task.status === "in_progress")
      .length,
    done: snapshot.tasks.filter((task) => task.status === "done").length,
    overdue: snapshot.tasks.filter((task) => dueInfo(task)?.overdue).length,
  };
  const completion = stats.total
    ? Math.round((stats.done / stats.total) * 100)
    : 0;
  const blocked = busy || !!refreshError;
  function exportBoard() {
    const blob = new Blob(
      [
        JSON.stringify(
          { exported_at: new Date().toISOString(), ...snapshot },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nextplay-workspace.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast({ text: "Workspace exported." });
  }
  const selectedTask =
    dialog && "id" in dialog && dialog.id
      ? snapshot.tasks.find((task) => task.id === dialog.id)
      : undefined;

  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            navigate("board");
          }}
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          nextplay<span className="brand-period">.</span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">S</span>
          <div>
            <strong>Studio workspace</strong>
            <span>Good things in the making</span>
          </div>
          <span className="workspace-dot" />
        </div>
        <div className="nav-section-label">WORKSPACE</div>
        <nav aria-label="Workspace navigation">
          <button
            className={page === "board" ? "nav-item active" : "nav-item"}
            onClick={() => navigate("board")}
          >
            <LayoutGrid size={18} />
            Task board<span className="nav-count">{stats.total}</span>
          </button>
          <button
            className={page === "overview" ? "nav-item active" : "nav-item"}
            onClick={() => navigate("overview")}
          >
            <BarChart3 size={18} />
            Overview
          </button>
          <button
            className={page === "team" ? "nav-item active" : "nav-item"}
            onClick={() => navigate("team")}
          >
            <Users size={18} />
            Team members
            <span className="nav-count">{snapshot.members.length}</span>
          </button>
        </nav>
        <div className="sidebar-divider" />
        <div className="nav-section-label">YOUR PROJECT</div>
        <button className="project-item" onClick={() => navigate("board")}>
          <span className="project-dot" />
          Product launch<span className="project-lock">Private</span>
        </button>
        <div className="sidebar-team">
          <div className="nav-section-label">
            THE PEOPLE
            <button
              className="icon-button"
              onClick={() => setDialog({ type: "member" })}
              disabled={blocked || !repository}
              aria-label="Add team member"
            >
              <Plus size={15} />
            </button>
          </div>
          {snapshot.members.slice(0, 4).map((member) => (
            <button
              className="sidebar-member"
              key={member.id}
              onClick={() => {
                setAssignee(member.id);
                setShowFilters(true);
                navigate("board");
              }}
            >
              <Avatar member={member} size="avatar-small" />
              <span>{member.name}</span>
              <span className="member-online" />
            </button>
          ))}
          {snapshot.members.length > 4 && (
            <button
              className="sidebar-see-team"
              onClick={() => navigate("team")}
            >
              View all {snapshot.members.length} teammates
              <ArrowRight size={12} />
            </button>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sparkles size={19} />
            <strong>Small steps. Big things.</strong>
            <p>Your next great idea starts with a little space to think.</p>
            <button onClick={() => setDialog({ type: "help" })}>
              Make yourself at home
              <ArrowUpRight size={13} />
            </button>
          </div>
          <button
            className="sidebar-settings"
            onClick={() => setDialog({ type: "settings" })}
          >
            <Settings2 size={17} />
            Workspace settings
          </button>
          <div className="guest-profile">
            <Avatar member={{ name: "Guest User", color: "#e3e7fc" }} />
            <div>
              <strong>Guest workspace</strong>
              <span>
                {repository?.mode === "supabase"
                  ? "Connected to Supabase"
                  : "Local demo · This browser"}
              </span>
            </div>
            <span className="guest-status" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <FolderKanban size={16} />
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {page === "team"
                ? "Team members"
                : page === "overview"
                  ? "Overview"
                  : "Product launch"}
            </strong>
          </div>
          <div className="topbar-right">
            <span
              className={`connection-pill ${repository?.mode === "supabase" ? "connection-cloud" : ""}`}
            >
              <span />
              {repository?.mode === "supabase"
                ? "Cloud workspace"
                : "Local demo"}
            </span>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              aria-label="How to use Nextplay"
              onClick={() => setDialog({ type: "help" })}
            >
              <CircleHelp size={18} />
            </button>
            <Avatar
              member={{ name: "Guest User", color: "#e3e7fc" }}
              size="avatar-small"
            />
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="heading-eyebrow">
                <span className="project-symbol">
                  <Target size={15} />
                </span>
                LET’S BUILD SOMETHING GREAT
              </div>
              <div className="heading-title">
                <h1>
                  {page === "team"
                    ? "Better, together."
                    : page === "overview"
                      ? "A little perspective."
                      : "Product launch"}
                </h1>
                {page === "board" && (
                  <span className="project-status">
                    <span />
                    In motion
                  </span>
                )}
              </div>
              <p>
                {page === "team"
                  ? "The people behind the ideas. Give every task its person."
                  : page === "overview"
                    ? "See how far you’ve come, and what’s coming next."
                    : "Big ideas. Small steps. Great things ahead."}
              </p>
            </div>
            <div className="heading-actions">
              {page === "board" && (
                <div className="team-stack">
                  {snapshot.members.slice(0, 3).map((member) => (
                    <Avatar
                      key={member.id}
                      member={member}
                      size="avatar-small"
                    />
                  ))}
                  <button
                    aria-label="Add teammate"
                    onClick={() => setDialog({ type: "member" })}
                    disabled={blocked || !repository}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}
              <button
                className="button button-primary"
                onClick={() =>
                  page === "team" ? setDialog({ type: "member" }) : addTask()
                }
                disabled={blocked || !repository || loading}
              >
                <Plus size={16} />
                {page === "team" ? "Add teammate" : "New task"}
              </button>
            </div>
          </div>
          {loading ? (
            <div className="loading-state" role="status">
              <LoaderCircle className="spin" size={28} />
              <h2>Making room for your ideas…</h2>
              <p>Opening your private workspace.</p>
              <div className="skeleton-board">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item}>
                    <i />
                    <i />
                    <i />
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="error-state" role="alert">
              <Cloud size={30} />
              <h2>Let’s get you connected.</h2>
              <p>{error}</p>
              <button
                className="button button-primary"
                onClick={() => void initialize()}
              >
                <RefreshCw size={15} />
                Try again
              </button>
            </div>
          ) : (
            <>
              {refreshError && (
                <div className="error-banner" role="alert">
                  <span>{refreshError}</span>
                  <button
                    className="button button-secondary"
                    onClick={() => void refresh()}
                    disabled={busy}
                  >
                    <RefreshCw size={14} />
                    Refresh board
                  </button>
                </div>
              )}
              {page !== "team" && (
                <div className="stats-row">
                  <div className="stat">
                    <span className="stat-icon stat-total">
                      <FolderKanban size={17} />
                    </span>
                    <span className="stat-label">
                      Total tasks
                      <strong>{stats.total.toString().padStart(2, "0")}</strong>
                    </span>
                    <span className="stat-context">A place for every idea</span>
                  </div>
                  <div className="stat">
                    <span className="stat-icon stat-progress">
                      <Clock3 size={17} />
                    </span>
                    <span className="stat-label">
                      In progress
                      <strong>
                        {stats.active.toString().padStart(2, "0")}
                      </strong>
                    </span>
                    <span className="stat-context">Moving things forward</span>
                  </div>
                  <div className="stat">
                    <span className="stat-icon stat-completed">
                      <CheckCircle2 size={17} />
                    </span>
                    <span className="stat-label">
                      Completed
                      <strong>{stats.done.toString().padStart(2, "0")}</strong>
                    </span>
                    <span className="stat-context">Little wins add up</span>
                  </div>
                  <div className="stat">
                    <span className="stat-icon stat-overdue">
                      <Flag size={17} />
                    </span>
                    <span className="stat-label">
                      Overdue
                      <strong>
                        {stats.overdue.toString().padStart(2, "0")}
                      </strong>
                    </span>
                    <span className="stat-context">
                      {stats.overdue
                        ? "Could use a little love"
                        : "Right on track"}
                    </span>
                  </div>
                </div>
              )}
              {page === "board" && (
                <>
                  <div className="board-view-bar">
                    <div
                      className="view-tabs"
                      role="tablist"
                      aria-label="Task view"
                    >
                      <button
                        role="tab"
                        aria-selected={view === "board"}
                        className={view === "board" ? "active" : ""}
                        onClick={() => setView("board")}
                      >
                        <Columns3 size={16} />
                        Board
                      </button>
                      <button
                        role="tab"
                        aria-selected={view === "list"}
                        className={view === "list" ? "active" : ""}
                        onClick={() => setView("list")}
                      >
                        <List size={17} />
                        List
                      </button>
                    </div>
                    <div className="completion">
                      <span>Project progress</span>
                      <div className="mini-progress">
                        <i style={{ width: `${completion}%` }} />
                      </div>
                      <strong>{completion}%</strong>
                    </div>
                  </div>
                  <div className="board-toolbar">
                    <div className="search-box">
                      <Search size={16} />
                      <input
                        ref={searchRef}
                        aria-label="Search tasks"
                        placeholder="Search tasks…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                      {search ? (
                        <button
                          className="icon-button"
                          onClick={() => setSearch("")}
                          aria-label="Clear search"
                        >
                          <X size={13} />
                        </button>
                      ) : (
                        <kbd>⌘ K</kbd>
                      )}
                    </div>
                    <div className="toolbar-right">
                      <span className="result-count">
                        {filtered.length} tasks
                      </span>
                      <button
                        className="button button-secondary labels-button"
                        onClick={() => setDialog({ type: "labels" })}
                        disabled={blocked}
                        aria-label="Manage labels"
                      >
                        <Tags size={14} />
                        <span>Labels</span>
                      </button>
                      <button
                        className={`button button-secondary filter-button ${showFilters || filterCount ? "filter-active" : ""}`}
                        onClick={() => setShowFilters(!showFilters)}
                        aria-expanded={showFilters}
                      >
                        <SlidersHorizontal size={14} />
                        Filter{filterCount > 0 && <span>{filterCount}</span>}
                      </button>
                      <div className="sort-box">
                        <span>Sort:</span>
                        <select
                          aria-label="Sort tasks"
                          value={sort}
                          onChange={(event) => setSort(event.target.value)}
                        >
                          <option value="created">Created date</option>
                          <option value="due">Due date</option>
                          <option value="title">Task name</option>
                        </select>
                        <ChevronDown size={12} />
                      </div>
                      <button
                        className="icon-button refresh-button"
                        aria-label="Refresh board"
                        onClick={() => void refresh()}
                        disabled={busy}
                      >
                        <RefreshCw className={busy ? "spin" : ""} size={15} />
                      </button>
                    </div>
                  </div>
                  {showFilters && (
                    <div className="filter-row">
                      <label>
                        Priority
                        <select
                          aria-label="Filter by priority"
                          value={priority}
                          onChange={(event) => setPriority(event.target.value)}
                        >
                          <option value="all">All priorities</option>
                          {(["high", "normal", "low"] as const).map((value) => (
                            <option value={value} key={value}>
                              {priorityTitle(value)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Assignee
                        <select
                          aria-label="Filter by assignee"
                          value={assignee}
                          onChange={(event) => setAssignee(event.target.value)}
                        >
                          <option value="all">Everyone</option>
                          <option value="unassigned">Unassigned</option>
                          {snapshot.members.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Label
                        <select
                          aria-label="Filter by label"
                          value={label}
                          onChange={(event) => setLabel(event.target.value)}
                        >
                          <option value="">All labels</option>
                          {snapshot.labels.map((label) => (
                            <option key={label.id} value={label.name}>
                              {label.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="button button-quiet"
                        onClick={clearFilters}
                      >
                        <X size={13} />
                        Clear filters
                      </button>
                    </div>
                  )}
                  {(search || filterCount > 0) && !filtered.length && (
                    <div className="no-results" role="status">
                      <Search size={17} />
                      <span>No tasks match your filters.</span>
                      <button onClick={clearFilters}>Clear all</button>
                    </div>
                  )}
                  {view === "board" ? (
                    <Board
                      tasks={filtered}
                      snapshot={snapshot}
                      onEdit={editTask}
                      onComments={openComments}
                      runAction={runAction}
                      onAdd={addTask}
                      onMove={(task, status) => void move(task, status)}
                      disabled={blocked}
                    />
                  ) : (
                    <TaskList
                      tasks={filtered}
                      members={snapshot.members}
                      onOpen={openTask}
                      onEdit={editTask}
                      disabled={blocked}
                    />
                  )}
                  <div className="board-footnote">
                    <span>
                      <span className="tiny-spark">✧</span>A little progress,
                      every day.
                    </span>
                    <span>
                      {repository?.mode === "local"
                        ? "Sample workspace · Changes saved in this browser"
                        : "Private guest workspace · Saved to Supabase"}
                      <span className="save-dot" />
                    </span>
                  </div>
                </>
              )}
              {page === "overview" && (
                <div className="overview-grid">
                  <section className="overview-card">
                    <span className="eyebrow">ONE STEP AT A TIME</span>
                    <h2>Your ideas are taking shape.</h2>
                    <p>
                      {stats.done} of {stats.total} tasks completed. Every small
                      step counts.
                    </p>
                    <div className="large-progress">
                      <i style={{ width: `${completion}%` }} />
                    </div>
                    <div className="progress-total">
                      <strong>{completion}% complete</strong>
                      <span>{stats.total - stats.done} tasks to go</span>
                    </div>
                    <div className="status-breakdown">
                      {COLUMNS.map((column) => (
                        <div key={column.id}>
                          <StatusIcon status={column.id} />
                          <span>{column.title}</span>
                          <strong>
                            {
                              snapshot.tasks.filter(
                                (task) => task.status === column.id,
                              ).length
                            }
                          </strong>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="overview-card">
                    <span className="eyebrow">A LITTLE EXTRA ATTENTION</span>
                    <h2>
                      {stats.overdue
                        ? "Let’s get back on track."
                        : "Looking good from here."}
                    </h2>
                    <p>
                      {stats.overdue
                        ? "These tasks have passed their due dates."
                        : "No overdue tasks. Keep that momentum going."}
                    </p>
                    {snapshot.tasks
                      .filter((task) => dueInfo(task)?.overdue)
                      .map((task) => (
                        <button
                          className="upcoming-task"
                          key={task.id}
                          onClick={() => openTask(task)}
                        >
                          <StatusIcon status={task.status} />
                          <span>
                            {task.title}
                            <small>Due {dueInfo(task)?.label}</small>
                          </span>
                          <ArrowUpRight size={17} />
                        </button>
                      ))}
                    <button
                      className="button button-secondary overview-back"
                      onClick={() => navigate("board")}
                    >
                      Back to the board
                      <ArrowRight size={15} />
                    </button>
                  </section>
                </div>
              )}
              {page === "team" && (
                <>
                  <div className="team-intro">
                    <Users size={17} />
                    <span>
                      {snapshot.members.length} people, one shared direction.
                    </span>
                    <span>Assignee profiles in your private workspace</span>
                  </div>
                  <div className="team-grid">
                    {snapshot.members.map((member) => {
                      const tasks = snapshot.tasks.filter(
                        (task) => task.assignee_id === member.id,
                      );
                      return (
                        <article className="member-card" key={member.id}>
                          <Avatar member={member} size="avatar-large" />
                          <h2>{member.name}</h2>
                          <span className="member-role">
                            Workspace teammate
                          </span>
                          <div className="member-stats">
                            <div>
                              <strong>{tasks.length}</strong>
                              <span>Assigned tasks</span>
                            </div>
                            <div>
                              <strong>
                                {
                                  tasks.filter((task) => task.status === "done")
                                    .length
                                }
                              </strong>
                              <span>Completed</span>
                            </div>
                          </div>
                          <button
                            className="button button-secondary"
                            onClick={() => {
                              setAssignee(member.id);
                              setShowFilters(true);
                              navigate("board");
                            }}
                          >
                            View tasks
                            <ArrowUpRight size={14} />
                          </button>
                        </article>
                      );
                    })}
                    <button
                      className="member-card add-member-card"
                      onClick={() => setDialog({ type: "member" })}
                      disabled={blocked}
                    >
                      <span>
                        <Plus size={25} />
                      </span>
                      <h2>Room for one more.</h2>
                      <p>Add a teammate to your workspace</p>
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
      {dialog?.type === "task" && (!dialog.id || selectedTask) && (
        <TaskDialog
          key={dialog.id || `new-${dialog.status}`}
          task={selectedTask}
          initialStatus={dialog.status}
          snapshot={snapshot}
          busy={busy}
          runAction={runAction}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "member" && (
        <MemberDialog
          busy={busy}
          runAction={runAction}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "details" && selectedTask && (
        <TaskDetailsDialog
          task={selectedTask}
          snapshot={snapshot}
          busy={busy}
          runAction={runAction}
          onEdit={editTask}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "comments" && selectedTask && (
        <TaskCommentsDialog
          task={selectedTask}
          snapshot={snapshot}
          busy={busy}
          runAction={runAction}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "labels" && (
        <LabelsDialog
          snapshot={snapshot}
          busy={busy}
          runAction={runAction}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "help" && (
        <Modal
          title="A little space to do great work."
          subtitle="Welcome to Nextplay. Make yourself at home."
          onClose={() => setDialog(null)}
        >
          <div className="help-content">
            <div>
              <span>01</span>
              <section>
                <h3>Start with a small step</h3>
                <p>
                  Click New task to capture an idea. Add a description,
                  priority, due date, labels, or a teammate.
                </p>
              </section>
            </div>
            <div>
              <span>02</span>
              <section>
                <h3>Let your work move</h3>
                <p>
                  Drag a card between columns. On a touch screen, hold the card
                  briefly first. Double-click a card or use its pencil button
                  when you want to edit its details.
                </p>
              </section>
            </div>
            <div>
              <span>03</span>
              <section>
                <h3>Keep the conversation close</h3>
                <p>
                  Click a card to expand its full description, information,
                  comments, and activity. Click the comment icon for a separate
                  conversation panel. Use search and filters to find your focus.
                </p>
              </section>
            </div>
          </div>
          <p className="help-note">
            {repository?.mode === "local"
              ? "Local demo: this workspace and its sample tasks are saved in this browser. Different browser profiles have separate workspaces. Cloud sync will be available after you configure Supabase."
              : "Your anonymous Supabase session owns this workspace. Clearing browser data or changing devices creates a different guest account."}
          </p>
          <div className="modal-footer">
            <button
              className="button button-primary footer-actions"
              onClick={() => setDialog(null)}
            >
              Let’s make things happen
              <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
      {dialog?.type === "settings" && (
        <Modal
          title="Your own little corner."
          subtitle="A private workspace, ready when inspiration strikes."
          onClose={() => setDialog(null)}
        >
          <div className="settings-detail">
            <span>Workspace</span>
            <strong>Studio workspace / Product launch</strong>
          </div>
          <div className="settings-detail">
            <span>Storage</span>
            <strong>
              {repository?.mode === "supabase"
                ? "Supabase · Anonymous guest account"
                : "Local demo · Browser storage"}
            </strong>
          </div>
          <div className="settings-detail">
            <span>Guest ID</span>
            <code>{repository?.userId || "Not connected"}</code>
          </div>
          <p className="help-note">
            {repository?.mode === "local"
              ? "Your changes persist when you refresh. They are only available in this browser profile. To enable cloud storage and server-enforced user isolation, follow the Supabase setup in README.md."
              : "Tasks, comments, and team members are stored in Supabase. Row Level Security isolates your data by guest account. Anonymous accounts cannot be recovered after clearing browser storage."}
          </p>
          <button
            className="button button-secondary export-button"
            onClick={exportBoard}
            disabled={!repository || loading}
          >
            <ArrowDownToLine size={16} />
            Export workspace as JSON
          </button>
          <div className="modal-footer">
            <button
              className="button button-primary footer-actions"
              onClick={() => setDialog(null)}
            >
              All set
              <Check size={15} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <CircleHelp size={17} /> : <CheckCircle2 size={17} />}
          <span>{toast.text}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
