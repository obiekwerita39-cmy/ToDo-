import type { Logger } from "pino";

type Priority = "low" | "medium" | "high";

type TaskSuggestion = {
  title: string;
  priority: Priority;
  category: string;
  dueDate: string | null;
};

type Suggestions = {
  intro: string;
  tasks: TaskSuggestion[];
};

function fallbackSuggestions(prompt: string): Suggestions {
  const cleanPrompt = prompt.trim().replace(/\s+/g, " ");
  const lowerPrompt = cleanPrompt.toLowerCase();
  const category = lowerPrompt.includes("work")
    ? "Work"
    : lowerPrompt.includes("home")
      ? "Home"
      : lowerPrompt.includes("study") || lowerPrompt.includes("learn")
        ? "Learning"
        : "Planning";
  const priority: Priority = lowerPrompt.includes("urgent") || lowerPrompt.includes("today")
    ? "high"
    : lowerPrompt.includes("someday") || lowerPrompt.includes("when i can")
      ? "low"
      : "medium";
  const pieces = cleanPrompt
    .split(/,|;|\band then\b|\bthen\b|\band\b/i)
    .map((piece) => piece.trim().replace(/^to\s+/i, ""))
    .filter((piece) => piece.length > 2);
  const firstTitle = cleanPrompt.charAt(0).toUpperCase() + cleanPrompt.slice(1);
  const titles = [
    firstTitle,
    pieces.length > 1 ? `Gather what you need for ${pieces[0]}` : "Define the first concrete step",
    pieces.length > 1 ? `Set a finish line for ${pieces[pieces.length - 1]}` : "Block time to make progress",
  ];

  return {
    intro: `I turned “${cleanPrompt}” into a focused starting plan.`,
    tasks: [...new Set(titles)].slice(0, 3).map((title, index) => ({
      title,
      priority: index === 0 ? priority : "medium",
      category,
      dueDate: null,
    })),
  };
}

function parseOpenAiResponse(content: string): Suggestions | null {
  try {
    const parsed = JSON.parse(content) as Partial<Suggestions>;
    if (!parsed.intro || !Array.isArray(parsed.tasks)) return null;
    const tasks = parsed.tasks.filter(
      (task): task is TaskSuggestion =>
        typeof task === "object" &&
        task !== null &&
        typeof task.title === "string" &&
        ["low", "medium", "high"].includes(task.priority) &&
        typeof task.category === "string" &&
        (typeof task.dueDate === "string" || task.dueDate === null),
    );
    return tasks.length > 0 ? { intro: parsed.intro, tasks: tasks.slice(0, 6) } : null;
  } catch {
    return null;
  }
}

export async function generateTaskSuggestions(prompt: string, log: Logger): Promise<Suggestions> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log.info("OPENAI_API_KEY is not configured; using local task planner");
    return fallbackSuggestions(prompt);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Turn the user prompt into 2 to 6 actionable tasks. Return only JSON with {"intro":"string","tasks":[{"title":"string","priority":"low|medium|high","category":"string","dueDate":"YYYY-MM-DD or null"}]}. Keep titles concise. Infer dates only when explicit.',
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      log.warn({ status: response.status }, "OpenAI request failed; using local planner");
      return fallbackSuggestions(prompt);
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const parsed = parseOpenAiResponse(body.choices?.[0]?.message?.content ?? "");
    return parsed ?? fallbackSuggestions(prompt);
  } catch (error) {
    log.warn({ err: error }, "OpenAI request errored; using local planner");
    return fallbackSuggestions(prompt);
  }
}