/** What invoke.ts and ab.ts read from a headless agent run: its tool calls, hook events and the PATH shim that counts hook invocations. */

/** One tool call; `ok` is false when the call itself failed (a failed call is not an invocation). `result` is an MCP call's result as JSON text, for validity checks only: it is never written to a row. */
export interface Event { tool: string; detail: string; ok: boolean; id?: string; result?: string }
export interface Inventory { plugins: { name: string; path?: string; source?: string }[]; mcpServers: { name: string; status: string }[] }
// Rows are committed to a public repo: a hook keeps what validity needs, not the user's plugin
// list, local paths or the hook's skill text. `injected` names the skills whose full text the hook
// put in context: those reach the agent without an open.
export interface HookExecution { id: string; name: string; exit_code?: number; outcome?: string; context: boolean; injected: string[] }

/** Tool calls from Claude's stream-json or Codex's --json event stream. */
export function toolEvents(stream: string): { events: Event[]; hooks: HookExecution[]; costUsd?: number; inventory?: Inventory; failedBeforeModel: boolean; result?: { isError: boolean; subtype?: string }; finalMessage?: string } {
  const events: Event[] = [];
  const hooks = new Map<string, HookExecution>();
  let costUsd: number | undefined;
  let failedBeforeModel = false;
  let modelResponded = false;
  let result: { isError: boolean; subtype?: string } | undefined;
  let inventory: Inventory | undefined;
  let finalMessage: string | undefined;
  for (const line of stream.split('\n')) {
    let e: any;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.type === 'system' && e.subtype === 'init') {
      // A malformed init counts as no inventory, so the row is still saved as invalid.
      inventory = Array.isArray(e.plugins) ? { plugins: e.plugins, mcpServers: Array.isArray(e.mcp_servers) ? e.mcp_servers : [] } : undefined;
    } else if (e.type === 'system' && e.hook_event === 'UserPromptSubmit' && (e.subtype === 'hook_started' || e.subtype === 'hook_response')) {
      const hook: HookExecution = hooks.get(e.hook_id) ?? { id: e.hook_id, name: e.hook_name, context: false, injected: [] };
      if (e.subtype === 'hook_response') {
        hook.exit_code = e.exit_code;
        hook.outcome = e.outcome;
        // Silent hooks and other hooks need not return JSON.
        let context: unknown;
        try { context = JSON.parse(e.stdout).hookSpecificOutput?.additionalContext; } catch { context = undefined; }
        if (typeof context === 'string') {
          hook.context = context.includes('<skill_relevance>');
          hook.injected = [...context.matchAll(/<skill name="([^"]*)"/g)].map((m) => m[1]!);
        }
      }
      hooks.set(e.hook_id, hook);
    } else if (e.type === 'assistant') {
      modelResponded = true;
      // A call only counts once its result arrives without an error.
      for (const b of e.message?.content ?? []) if (b.type === 'tool_use') events.push({ tool: b.name, detail: JSON.stringify(b.input), ok: false, id: b.id });
    } else if (e.type === 'user') {
      // Claude reports each tool result in the next user message.
      for (const b of e.message?.content ?? []) {
        if (b.type === 'tool_result' && !b.is_error) {
          for (const ev of events) if (ev.id === b.tool_use_id) { ev.ok = true; if (ev.tool.startsWith('mcp__')) ev.result = JSON.stringify(b.content ?? ''); }
        }
      }
    } else if (e.type === 'result') {
      if (typeof e.result === 'string') finalMessage = e.result;
      costUsd = e.total_cost_usd;
      // An expired login ends as is_error at $0 (seen 2026-10-12). It would otherwise read as a miss.
      // A run that used its turns has a cost, so it stays a valid miss as in the earlier arms.
      failedBeforeModel = e.is_error === true && !(e.total_cost_usd > 0);
      // Kept on the row, so analysis can tell a quota or API stop after billed turns from a miss.
      result = { isError: e.is_error === true, subtype: e.subtype };
    } else if (e.type === 'item.completed') {
      const it = e.item ?? {};
      if (it.type === 'agent_message' && typeof it.text === 'string') finalMessage = it.text;
      const toolError = it.result?.isError === true || it.result?.is_error === true;
      const ok = it.status === 'completed' && !it.error && !toolError && (it.exit_code === undefined || it.exit_code === null || it.exit_code === 0);
      if (it.type === 'command_execution') events.push({ tool: 'shell', detail: String(it.command ?? ''), ok });
      if (it.type === 'mcp_tool_call') events.push({ tool: `mcp__${it.server}__${it.tool}`, detail: JSON.stringify(it.arguments ?? {}), ok, result: JSON.stringify(it.result ?? '') });
    }
  }
  // A run killed before any model response (a stall after init and the hook) sends no result event.
  if (!result) failedBeforeModel = !modelResponded;
  return { events, hooks: [...hooks.values()], costUsd, inventory, failedBeforeModel, result, finalMessage };
}

const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * A `loadout` for PATH that counts how often the host calls the hook (`marker` gets "invoked" before it runs, so a
 * killed hook still counts, "exit <status>" once it ends, so an unfinished invocation has none, and "context" after it, so
 * a silent invocation cannot cover for context an uncounted hook supplied) and, when `capture` is given, keeps each invocation's one-line output there and its stderr in
 * `<capture>.err` (the host then no longer sees that stderr; a hook that exits 0 has none it reads).
 */
export function hookShim(marker: string, command: string, capture?: string): string {
  const m = quote(marker);
  return `#!/bin/sh\nprintf 'invoked\\n' >> ${m}\nout=$(/bin/sh -c ${quote(command)}${capture ? ` 2>> ${quote(`${capture}.err`)}` : ''}); status=$?\nprintf 'exit %s\\n' "$status" >> ${m}\ncase $out in *'<skill_relevance>'*) printf 'context\\n' >> ${m};; esac\n${capture ? `printf '%s\\n' "$out" >> ${quote(capture)}\n` : ''}printf '%s' "$out"\nexit $status\n`;
}
