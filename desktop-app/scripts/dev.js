// Dev wrapper. Intercepts CLI args, splits electron-vite flags from
// Electron-only flags (--invite, --storage, --name, --writer, --no-updates),
// and writes them to a temp file the main process reads.
//
// Usage:
//   npm run dev                              # plain dev (host)
//   npm run dev -- --invite <code>           # guest join
//   npm run dev -- --invite <code> --storage ./tmp-guest
//
// Why: electron-vite uses `cac` for strict CLI parsing, so unknown
// flags like --invite crash before the dev server even starts. This
// wrapper consumes those flags and writes them to a temp file the
// main process (src/main/index.ts) reads on boot.

const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const ELECTRON_FLAGS = new Set([
  '--invite',
  '--storage',
  '--name',
  '--writer',
  '--no-updates'
])

const rawArgs = process.argv.slice(2)
const electronArgs = []
for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i]
  if (ELECTRON_FLAGS.has(arg)) {
    electronArgs.push(arg)
    if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('--')) {
      electronArgs.push(rawArgs[++i])
    }
  } else if (arg.startsWith('--') && i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('--')) {
    // Unknown long flag — skip its value, don't forward.
    i++
  }
}

if (electronArgs.length > 0) {
  // Write to a temp file the main process reads on startup.
  const tmpFile = path.join(os.tmpdir(), `tamaflow-args-${process.pid}.json`)
  fs.writeFileSync(tmpFile, JSON.stringify(electronArgs))
  process.env.TAMAFLOW_DEV_ARGS_FILE = tmpFile
  console.log('[dev] forwarding Electron args:', electronArgs.join(' '))
  console.log('[dev] args file:', tmpFile)
}

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['electron-vite', 'dev'],
  {
    stdio: 'inherit',
    env: process.env,
    cwd: path.resolve(__dirname, '..'),
    shell: process.platform === 'win32'
  }
)

child.on('exit', (code) => {
  // Clean up the args file on exit.
  if (process.env.TAMAFLOW_DEV_ARGS_FILE) {
    try { fs.unlinkSync(process.env.TAMAFLOW_DEV_ARGS_FILE) } catch {}
  }
  process.exit(code ?? 0)
})
