import { emitKeypressEvents } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';

export type PromptOptions = {
  /** Optional validator applied to the raw answer. Throw to reject. */
  validate?: (raw: string) => string;
  /** If true, hide input as the user types (for secrets like keys/secrets). */
  secret?: boolean;
};

/**
 * Read a single line from stdin with an optional validator.
 *
 * We bypass `readline.question()` and read directly from `process.stdin`
 * with `on('data')` — `rl.question()` was racing with the pino logger
 * under tsx on Windows/PowerShell and resolving with `undefined`
 * immediately. The lower-level approach works reliably across TTY
 * and piped stdin.
 *
 * If `opts.secret` is true and stdin is a TTY, characters are masked
 * with `*` as they're typed.
 */
export async function prompt(
  question: string,
  opts: PromptOptions = {},
): Promise<string> {
  if (opts.secret && input.isTTY) {
    return readSecret(question, opts.validate);
  }
  const answer = await readLine(question);
  return opts.validate ? opts.validate(answer) : answer;
}

/**
 * Write the prompt to stdout and read one line from stdin.
 * Resolves with the line content (newline stripped).
 */
function readLine(prompt: string): Promise<string> {
  output.write(prompt);
  return new Promise((resolve) => {
    let buffer = '';
    const onData = (chunk: Buffer): void => {
      buffer += chunk.toString('utf8');
      const newlineIdx = buffer.search(/[\r\n]/);
      if (newlineIdx >= 0) {
        input.removeListener('data', onData);
        input.pause();
        resolve(buffer.slice(0, newlineIdx));
      }
    };
    input.on('data', onData);
    input.resume();
  });
}

/**
 * Read a line from stdin with each typed character masked as `*`.
 *
 * Uses raw mode + `on('data')` instead of `emitKeypressEvents` /
 * `on('keypress')`. Keypress parsing in Node 22 was unreliable for
 * paste events under PowerShell — pasted chunks sometimes arrived as
 * events with a non-undefined `key.name` and got filtered out.
 * Data events fire for every byte regardless of keypress parsing,
 * so they handle paste and typing uniformly.
 */
async function readSecret(
  question: string,
  validate?: (raw: string) => string,
): Promise<string> {
  output.write(question);
  return new Promise<string>((resolve) => {
    const wasRaw = input.isRaw;
    input.setRawMode(true);
    let answer = '';

    const cleanup = (): void => {
      input.removeListener('data', onData);
      if (input.isTTY) input.setRawMode(wasRaw);
      input.pause();
    };

    const onData = (chunk: Buffer): void => {
      for (const ch of chunk.toString('utf8')) {
        const code = ch.charCodeAt(0);

        // Enter / Return — finish reading.
        if (code === 0x0d || code === 0x0a) {
          cleanup();
          output.write('\n');
          resolve(validate ? validate(answer) : answer);
          return;
        }

        // Ctrl+C — abort.
        if (code === 0x03) {
          cleanup();
          output.write('\n');
          process.exit(130);
        }

        // Backspace / Delete — erase one char.
        if (code === 0x08 || code === 0x7f) {
          if (answer.length > 0) {
            answer = answer.slice(0, -1);
            output.write('\b \b');
          }
          continue;
        }

        // Escape — start of a key sequence (arrows, function keys, etc.).
        // We don't try to parse the rest; just drop the escape so the
        // following bytes don't pollute the answer. For paste of hex
        // secrets this is never hit; if the user pastes non-ASCII it
        // also passes through cleanly because raw bytes arrive one chunk
        // at a time and we only filter 0x1b.
        if (code === 0x1b) {
          continue;
        }

        // Anything else: printable char (typed or part of a paste).
        answer += ch;
        output.write('*');
      }
    };

    input.on('data', onData);
    input.resume();
  });
}