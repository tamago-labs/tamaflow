import { pino, type LoggerOptions } from 'pino';
import pretty from 'pino-pretty';

/**
 * Pino logger configured for human-readable console output.
 *
 * Uses synchronous pino-pretty as a destination stream (not a
 * `transport`) so the main process owns stdin/stdout for readline
 * prompts. The transport form spawns a worker_thread that races
 * with `rl.question(...)` and causes it to resolve with `undefined`
 * before the user can type anything — particularly under tsx on
 * Windows.
 */
const options: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
};

export const logger = pino(
  options,
  pretty({
    colorize: true,
    translateTime: 'HH:MM:ss.l',
    ignore: 'pid,hostname',
    singleLine: false,
  }),
);