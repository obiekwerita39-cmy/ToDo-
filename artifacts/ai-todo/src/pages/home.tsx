import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Focus,
  Inbox,
  Leaf,
  ListFilter,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';

type Todo = {
  id: number;
  title: string;
  completed: boolean;
  priority: Priority;
  dueDate: string | null;
  category: string;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
};

type Filter = 'all' | 'active' | 'done';
type Priority = 'low' | 'medium' | 'high';
type Suggestion = { title: string; priority: Priority; category: string; dueDate: string | null };
type Suggestions = { intro: string; tasks: Suggestion[] };

const priorityLabels: Record<Priority, string> = { low: 'Low lift', medium: 'Worthwhile', high: 'Important' };

function formatDueDate(value: string | null) {
  if (!value) return null;
  const date = parseISO(value);
  if (isToday(date)) return 'Today';
  return format(date, 'MMM d');
}

function PriorityMark({ priority }: { priority: Priority }) {
  return (
    <span data-testid={`badge-priority-${priority}`} className={`priority-mark priority-${priority}`} aria-label={`${priorityLabels[priority]} priority`}>
      <span />
    </span>
  );
}

function SummaryCard({ summary, loading }: { summary?: { total: number; completed: number; remaining: number; completionRate: number; today: number }; loading: boolean }) {
  const rate = summary?.completionRate ?? 0;
  return (
    <section className="summary-card" data-testid="card-completion-summary">
      <div className="summary-copy">
        <div className="eyebrow">Your rhythm</div>
        <h2 data-testid="text-summary-heading">A little progress<br /><em>counts today.</em></h2>
        {loading ? (
          <div className="summary-skeleton" data-testid="status-summary-loading" />
        ) : (
          <p data-testid="text-summary-detail">
            {summary?.completed ?? 0} of {summary?.total ?? 0} tasks finished · {summary?.today ?? 0} on your plate today
          </p>
        )}
      </div>
      <div className="completion-ring" style={{ '--completion': `${rate}%` } as CSSProperties} data-testid="status-completion-rate">
        <div className="completion-ring-inner">
          {loading ? <span className="ring-dash">—</span> : <><strong>{Math.round(rate)}%</strong><small>complete</small></>}
        </div>
      </div>
    </section>
  );
}

function TaskRow({ todo, onToggle, onDelete }: { todo: Todo; onToggle: (todo: Todo) => void; onDelete: (todo: Todo) => void }) {
  const due = formatDueDate(todo.dueDate);
  return (
    <article className={`task-row ${todo.completed ? 'is-complete' : ''}`} data-testid={`row-todo-${todo.id}`}>
      <button
        className={`task-check ${todo.completed ? 'checked' : ''}`}
        onClick={() => onToggle(todo)}
        aria-label={todo.completed ? `Mark ${todo.title} active` : `Complete ${todo.title}`}
        data-testid={`button-toggle-todo-${todo.id}`}
      >
        {todo.completed && <Check size={14} strokeWidth={3} />}
      </button>
      <div className="task-body">
        <div className="task-title-wrap">
          <span className="task-title" data-testid={`text-todo-title-${todo.id}`}>{todo.title}</span>
          {todo.aiGenerated && <span className="ai-chip" data-testid={`badge-ai-todo-${todo.id}`}><Sparkles size={11} /> from prompt</span>}
        </div>
        <div className="task-meta">
          <span className="category-pill">{todo.category || 'General'}</span>
          {due && <span className={`due-date ${due === 'Today' ? 'due-today' : ''}`}><CalendarDays size={12} /> {due}</span>}
        </div>
      </div>
      <PriorityMark priority={todo.priority} />
      <button className="icon-button delete-button" onClick={() => onDelete(todo)} aria-label={`Delete ${todo.title}`} data-testid={`button-delete-todo-${todo.id}`}>
        <Trash2 size={16} />
      </button>
    </article>
  );
}

function TaskSkeleton() {
  return <div className="task-row task-skeleton" data-testid="status-todos-loading"><span /><div><i /><i /></div><b /></div>;
}

function SuggestionRow({ task, index, onAdd }: { task: Suggestion; index: number; onAdd: (task: Suggestion, index: number) => void }) {
  return (
    <div className="suggestion-row" data-testid={`row-suggestion-${index}`}>
      <div className="suggestion-index">{String(index + 1).padStart(2, '0')}</div>
      <div className="suggestion-main"><strong data-testid={`text-suggestion-title-${index}`}>{task.title}</strong><span>{task.category} · {priorityLabels[task.priority]}</span></div>
      <button className="suggestion-add" onClick={() => onAdd(task, index)} data-testid={`button-add-suggestion-${index}`}><Plus size={15} /> Add</button>
    </div>
  );
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [addedSuggestions, setAddedSuggestions] = useState<number[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [newTask, setNewTask] = useState('');
  const [showComposer, setShowComposer] = useState(false);

  const [todos, setTodos] = useState<Todo[]>(() => {
    try {
      const saved = localStorage.getItem('todo-ai-todos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('todo-ai-todos', JSON.stringify(todos));
  }, [todos]);

  const summary = useMemo(() => {
    const completed = todos.filter((todo) => todo.completed).length;
    const remaining = todos.length - completed;
    const today = todos.filter((todo) => {
      if (!todo.dueDate) return false;
      return isToday(parseISO(todo.dueDate));
    }).length;

    return {
      total: todos.length,
      completed,
      remaining,
      today,
      completionRate: todos.length ? (completed / todos.length) * 100 : 0,
    };
  }, [todos]);

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(todos.map((todo) => todo.category).filter(Boolean)))],
    [todos],
  );

  const visibleTodos = useMemo(
    () =>
      todos.filter((todo) => {
        const statusMatch =
          filter === 'all' ||
          (filter === 'active' ? !todo.completed : todo.completed);
        const categoryMatch =
          categoryFilter === 'all' || todo.category === categoryFilter;
        return statusMatch && categoryMatch;
      }),
    [todos, filter, categoryFilter],
  );

  const handleGenerate = (event: FormEvent) => {
    event.preventDefault();
    const cleanPrompt = prompt.trim();
    if (cleanPrompt.length < 3) return;

    const newSuggestions: Suggestions = {
      intro: `Here is a simple plan for "${cleanPrompt}".`,
      tasks: [
        {
          title: `Start: ${cleanPrompt}`,
          priority: 'high',
          category: 'Planning',
          dueDate: null,
        },
        {
          title: `Work on the main part of ${cleanPrompt}`,
          priority: 'medium',
          category: 'Work',
          dueDate: null,
        },
        {
          title: `Review your progress on ${cleanPrompt}`,
          priority: 'low',
          category: 'Review',
          dueDate: null,
        },
      ],
    };

    setSuggestions(newSuggestions);
    setAddedSuggestions([]);
  };

  const createLocalTodo = (
    data: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'completed'> &
      Partial<Pick<Todo, 'completed'>>,
  ) => {
    const now = new Date().toISOString();

    const todo: Todo = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      title: data.title,
      completed: data.completed ?? false,
      priority: data.priority,
      category: data.category,
      dueDate: data.dueDate,
      aiGenerated: data.aiGenerated,
      createdAt: now,
      updatedAt: now,
    };

    setTodos((current) => [todo, ...current]);
    return todo;
  };

  const addSuggestion = (task: Suggestion, index: number) => {
    if (addedSuggestions.includes(index)) return;

    createLocalTodo({
      title: task.title,
      priority: task.priority,
      category: task.category,
      dueDate: task.dueDate,
      aiGenerated: true,
    });

    setAddedSuggestions((current) => [...current, index]);
  };

  const addAllSuggestions = () => {
    suggestions?.tasks.forEach((task, index) => {
      if (!addedSuggestions.includes(index)) {
        addSuggestion(task, index);
      }
    });
  };

  const addManualTask = (event: FormEvent) => {
    event.preventDefault();
    const title = newTask.trim();
    if (!title) return;

    createLocalTodo({
      title,
      category: 'General',
      priority: 'medium',
      aiGenerated: false,
      dueDate: null,
    });

    setNewTask('');
    setShowComposer(false);
  };

  const toggleTodo = (todo: Todo) => {
    setTodos((current) =>
      current.map((item) =>
        item.id === todo.id
          ? {
              ...item,
              completed: !item.completed,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  };

  const removeTodo = (todo: Todo) => {
    if (!window.confirm(`Remove "${todo.title}" from your list?`)) return;
    setTodos((current) => current.filter((item) => item.id !== todo.id));
  };

  const currentFilterLabel =
    filter === 'all'
      ? 'Everything'
      : filter === 'active'
        ? 'In progress'
        : 'Completed';

  return (
    <div className="app-shell workspace-texture selection-warm" data-testid="page-todo-workspace">
      <aside className="sidebar">
        <div className="brand-lockup" data-testid="text-brand">
          <div className="brand-orbit"><Leaf size={18} /></div>
           <span>Todo</span>
        </div>
        <div className="sidebar-intro">
          <span className="sidebar-kicker">PERSONAL SPACE</span>
          <p>Plans that leave<br />room to breathe.</p>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          <button className="side-nav-item active" data-testid="button-nav-today"><Inbox size={17} /><span>Today</span><b>{summary.today}</b></button>
          <button className="side-nav-item" onClick={() => setFilter('active')} data-testid="button-nav-in-progress"><Focus size={17} /><span>In progress</span><b>{summary.remaining}</b></button>
          <button className="side-nav-item" onClick={() => setFilter('done')} data-testid="button-nav-completed"><CircleCheck size={17} /><span>Completed</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><Sparkles size={15} /><span>Try saying<br /><strong>“Get ready for Friday”</strong></span></div>
          <div className="sidebar-footer"><span className="avatar">AR</span><span><strong>Alex Rivera</strong><small>Personal workspace</small></span><ChevronDown size={14} /></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><span className="date-kicker"><Clock3 size={14} /> {format(new Date(), 'EEEE, MMMM d')}</span><h1 data-testid="heading-today">Good morning, Alex<span>.</span></h1></div>
          <div className="topbar-actions"><span className="focus-status"><span /> focus mode</span><button className="avatar mobile-avatar" aria-label="Open profile" data-testid="button-profile">AR</button></div>
        </header>

        <div className="content-grid">
          <div className="primary-column">
            <section className="prompt-card" data-testid="card-ai-prompt">
              <div className="prompt-ornament"><div /><div /><div /></div>
               <div className="prompt-heading"><span className="eyebrow"><Sparkles size={14} /> TODO AI</span><h2>What would make<br /><em>today feel lighter?</em></h2></div>
              <form onSubmit={handleGenerate} className="prompt-form">
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="e.g. Prepare for my trip next weekend..." maxLength={500} rows={2} data-testid="input-ai-prompt" />
                <div className="prompt-footer"><span>{prompt.length > 0 ? `${prompt.length} / 500` : 'A short thought is enough'}</span><button type="submit" className="generate-button" disabled={false || prompt.trim().length < 3} data-testid="button-generate-tasks">{false ? <><RefreshCw className="spin" size={16} /> Thinking...</> : <>Make a plan <ArrowUpRight size={16} /></>}</button></div>
              </form>
              {false && <div className="inline-error" data-testid="status-generate-error">That didn’t come through. Try again in a moment.</div>}
            </section>

            {false && (
              <section className="suggestions-card loading-suggestions" data-testid="status-generate-loading">
                <div className="suggestion-loading-title"><span /><span /></div>
                <div className="suggestion-loading-rows"><i /><i /><i /></div>
              </section>
            )}

            {suggestions && !false && (
              <section className="suggestions-card animate-rise" data-testid="card-ai-suggestions">
                <div className="suggestions-header"><div><span className="eyebrow"><Sparkles size={13} /> A THOUGHTFUL START</span><h3>{suggestions.intro || 'Here is a lighter way in.'}</h3></div><button className="icon-button" onClick={() => setSuggestions(null)} aria-label="Dismiss suggestions" data-testid="button-dismiss-suggestions"><X size={18} /></button></div>
                <div className="suggestion-list">{suggestions.tasks.map((task, index) => <SuggestionRow key={`${task.title}-${index}`} task={task} index={index} onAdd={addSuggestion} />)}</div>
                <div className="suggestions-footer"><span>{addedSuggestions.length} of {suggestions.tasks.length} added</span><button onClick={addAllSuggestions} disabled={addedSuggestions.length === suggestions.tasks.length} className="add-all-button" data-testid="button-add-all-suggestions"><Plus size={15} /> Add all to today</button></div>
              </section>
            )}

            <section className="tasks-section" data-testid="section-todos">
              <div className="section-heading"><div><div className="eyebrow">YOUR LIST</div><h2>{currentFilterLabel}<span className="count-bubble" data-testid="text-todo-count">{visibleTodos.length}</span></h2></div><button className="new-task-button" onClick={() => setShowComposer((current) => !current)} data-testid="button-new-task"><Plus size={17} /> New task</button></div>
              {showComposer && <form className="manual-composer animate-rise" onSubmit={addManualTask}><input autoFocus value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="Name the next small thing..." aria-label="New task title" data-testid="input-new-task" /><button type="submit" disabled={!newTask.trim()} data-testid="button-save-new-task"><Check size={16} /> Add</button></form>}
              <div className="filter-bar"><div className="filter-tabs">{(['all', 'active', 'done'] as Filter[]).map((item) => <button key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)} data-testid={`button-filter-${item}`}>{item === 'all' ? 'All' : item === 'active' ? 'To do' : 'Done'}</button>)}</div><label className="category-filter"><ListFilter size={14} /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category" data-testid="select-category-filter">{categories.map((category) => <option key={category} value={category}>{category === 'all' ? 'All areas' : category}</option>)}</select><ChevronDown size={13} /></label></div>
              <div className="todo-list">
                 {visibleTodos.length === 0 ? <div className="empty-state" data-testid="status-todos-empty"><div className="empty-mark"><Leaf size={23} /></div><strong>{filter === 'done' ? 'Nothing finished just yet.' : 'A clear page is a good place to begin.'}</strong><span>{filter === 'done' ? 'Your completed tasks will gather here.' : 'Ask Todo for a starting point above.'}</span></div> : visibleTodos.map((todo) => <TaskRow key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={removeTodo} />)}
              </div>
            </section>
          </div>
          <aside className="right-column">
            <SummaryCard summary={summary} loading={false} />
            <section className="mini-card" data-testid="card-focus-note"><div className="mini-card-top"><span className="eyebrow">A SMALL REMINDER</span><Leaf size={18} /></div><p>Momentum is not a mood you wait for. It is one small thing, then another.</p><span className="mini-card-line" /></section>
            <section className="areas-card" data-testid="card-areas"><div className="eyebrow">AREAS IN MOTION</div>{categories.slice(1, 4).map((category, index) => { const areaTodos = todos.filter((todo) => todo.category === category); const done = areaTodos.filter((todo) => todo.completed).length; return <button key={category} className="area-row" onClick={() => { setCategoryFilter(category); setFilter('all'); }} data-testid={`button-category-${category}`}><span className={`area-dot area-dot-${index}`} /><span>{category}</span><small>{done}/{areaTodos.length}</small></button>; })}{categories.length === 1 && <div className="areas-empty">Your areas will appear as you plan.</div>}</section>
          </aside>
        </div>
      </main>
    </div>
  );
}