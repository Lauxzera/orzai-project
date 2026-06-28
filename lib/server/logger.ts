import "server-only";

type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function write(level: LogLevel, scope: string, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    ...context,
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * Logger estruturado em JSON-por-linha, sem dependencia externa.
 * Os logs continuam saindo no stdout/stderr (capturados pelo Vercel), mas em
 * formato consistente e filtravel por scope/level — substitui console.error
 * solto nas rotas criticas (webhooks, crons, IA), onde falhas hoje so aparecem
 * se alguem for procurar no painel de logs no momento certo.
 */
export function createLogger(scope: string) {
  return {
    info: (message: string, context?: LogContext) => write("info", scope, message, context),
    warn: (message: string, context?: LogContext) => write("warn", scope, message, context),
    error: (message: string, error?: unknown, context?: LogContext) =>
      write("error", scope, message, {
        ...context,
        ...(error !== undefined ? { error: serializeError(error) } : {}),
      }),
  };
}
