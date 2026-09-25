import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, todosTable } from "@workspace/db";
import {
  CreateTodoBody,
  CreateTodoResponse,
  DeleteTodoParams,
  GenerateTasksBody,
  GenerateTasksResponse,
  GetTodoSummaryResponse,
  ListTodosResponse,
  UpdateTodoBody,
  UpdateTodoParams,
  UpdateTodoResponse,
} from "@workspace/api-zod";
import { generateTaskSuggestions } from "../lib/task-planner";

const router: IRouter = Router();

function toDateString(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

router.get("/todos", async (req, res): Promise<void> => {
  const todos = await db
    .select()
    .from(todosTable)
    .orderBy(desc(todosTable.createdAt));
  req.log.info({ count: todos.length }, "Listed todos");
  res.json(ListTodosResponse.parse(todos));
});

router.post("/todos", async (req, res): Promise<void> => {
  const parsed = CreateTodoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [todo] = await db
    .insert(todosTable)
    .values({
      title: parsed.data.title,
      priority: parsed.data.priority,
      dueDate: toDateString(parsed.data.dueDate),
      category: parsed.data.category,
      aiGenerated: parsed.data.aiGenerated,
    })
    .returning();

  res.status(201).json(CreateTodoResponse.parse(todo));
});

router.get("/todos/summary", async (_req, res): Promise<void> => {
  const todos = await db
    .select({
      completed: todosTable.completed,
      dueDate: todosTable.dueDate,
    })
    .from(todosTable);
  const today = new Date().toISOString().slice(0, 10);
  const completed = todos.filter((todo) => todo.completed).length;
  const total = todos.length;

  res.json(
    GetTodoSummaryResponse.parse({
      total,
      completed,
      remaining: total - completed,
      completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
      today: todos.filter((todo) => todo.dueDate === today && !todo.completed).length,
    }),
  );
});

router.patch("/todos/:id", async (req, res): Promise<void> => {
  const params = UpdateTodoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTodoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof todosTable.$inferInsert> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.completed !== undefined) updates.completed = parsed.data.completed;
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.category !== undefined) updates.category = parsed.data.category;
  if (parsed.data.dueDate !== undefined) updates.dueDate = toDateString(parsed.data.dueDate);
  updates.updatedAt = new Date();

  const [todo] = await db
    .update(todosTable)
    .set(updates)
    .where(eq(todosTable.id, params.data.id))
    .returning();

  if (!todo) {
    res.status(404).json({ error: "Todo not found" });
    return;
  }

  res.json(UpdateTodoResponse.parse(todo));
});

router.delete("/todos/:id", async (req, res): Promise<void> => {
  const params = DeleteTodoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [todo] = await db
    .delete(todosTable)
    .where(eq(todosTable.id, params.data.id))
    .returning({ id: todosTable.id });

  if (!todo) {
    res.status(404).json({ error: "Todo not found" });
    return;
  }

  res.status(204).send();
});

router.post("/ai/generate-tasks", async (req, res): Promise<void> => {
  const parsed = GenerateTasksBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const suggestions = await generateTaskSuggestions(parsed.data.prompt, req.log);
  res.json(GenerateTasksResponse.parse(suggestions));
});

export default router;