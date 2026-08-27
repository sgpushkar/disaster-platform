import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.join(__dirname, 'backend');

const isWin = process.platform === 'win32';
const venvUvicorn = isWin
  ? path.join(backendDir, 'venv', 'Scripts', 'uvicorn.exe')
  : path.join(backendDir, 'venv', 'bin', 'uvicorn');

const venvPython = isWin
  ? path.join(backendDir, 'venv', 'Scripts', 'python.exe')
  : path.join(backendDir, 'venv', 'bin', 'python');

let cmd = 'uvicorn';
let args = ['app.main:app', '--reload'];

if (fs.existsSync(venvUvicorn)) {
  cmd = venvUvicorn;
} else if (fs.existsSync(venvPython)) {
  cmd = venvPython;
  args = ['-m', 'uvicorn', 'app.main:app', '--reload'];
}

console.log(`[Backend] Starting FastAPI: ${cmd}`);

const proc = spawn(cmd, args, {
  cwd: backendDir,
  stdio: 'inherit',
  shell: false
});

proc.on('error', (err) => {
  console.error('[Backend] Failed to start backend process:', err.message);
});

proc.on('exit', (code) => {
  process.exit(code ?? 0);
});

// Handle termination signals cleanly
process.on('SIGINT', () => {
  proc.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  proc.kill('SIGTERM');
  process.exit(0);
});
