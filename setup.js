import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.join(__dirname, 'backend');
const frontendDir = path.join(__dirname, 'frontend');
const isWin = process.platform === 'win32';

const venvPython = isWin
  ? path.join(backendDir, 'venv', 'Scripts', 'python.exe')
  : path.join(backendDir, 'venv', 'bin', 'python');

const venvPip = isWin
  ? path.join(backendDir, 'venv', 'Scripts', 'pip.exe')
  : path.join(backendDir, 'venv', 'bin', 'pip');

function log(step, msg) {
  console.log(`\x1b[36m[Setup ${step}]\x1b[0m \x1b[1m${msg}\x1b[0m`);
}

function success(msg) {
  console.log(`\x1b[32m✔ ${msg}\x1b[0m`);
}

function warn(msg) {
  console.log(`\x1b[33m⚠ ${msg}\x1b[0m`);
}

function findSystemPython() {
  const candidates = isWin ? ['python', 'py', 'python3'] : ['python3', 'python'];
  for (const cmd of candidates) {
    try {
      const res = spawnSync(cmd, ['--version'], { encoding: 'utf-8' });
      if (res.status === 0) return cmd;
    } catch (_) {}
  }
  return null;
}

export function trainModels(pyCmd = venvPython) {
  log('4/5', 'Checking Machine Learning models...');
  const models = [
    { name: 'Disaster Risk Model', file: path.join(backendDir, 'models', 'disaster_risk_model.joblib'), script: 'ml/train_disaster_risk_model.py' },
    { name: 'DisasterScope Recon Model', file: path.join(backendDir, 'models', 'disasterscope_model.joblib'), script: 'ml/train_disasterscope_model.py' },
    { name: 'Rainfall LSTM Model', file: path.join(backendDir, 'models', 'lstm_model.joblib'), script: 'ml/train_rainfall_model.py' },
    { name: 'Flood Image Model', file: path.join(backendDir, 'models', 'flood_model.joblib'), script: 'ml/train_flood_model.py' }
  ];

  for (const m of models) {
    if (!fs.existsSync(m.file)) {
      console.log(`  -> Training missing ${m.name}...`);
      try {
        execSync(`"${pyCmd}" ${m.script}`, { cwd: __dirname, stdio: 'inherit' });
        success(`${m.name} successfully trained`);
      } catch (err) {
        warn(`Failed training ${m.name}: ${err.message}`);
      }
    } else {
      success(`${m.name} already trained and ready`);
    }
  }
}

export async function runSetup() {
  console.log('\n\x1b[35m========================================================\x1b[0m');
  console.log('\x1b[1m   AI Disaster Platform - Fast Automated Setup   \x1b[0m');
  console.log('\x1b[35m========================================================\x1b[0m\n');

  // Step 1: Python Virtual Environment
  log('1/5', 'Setting up Python virtual environment...');
  if (!fs.existsSync(venvPython)) {
    const sysPy = findSystemPython();
    if (!sysPy) {
      console.error('\x1b[31m✖ Error: Python 3.10+ not found in system PATH. Please install Python from https://www.python.org/downloads/\x1b[0m');
      process.exit(1);
    }
    console.log(`  Found system Python (${sysPy}). Creating backend/venv...`);
    execSync(`${sysPy} -m venv "${path.join(backendDir, 'venv')}"`, { stdio: 'inherit' });
    success('Python virtual environment created');
  } else {
    success('Virtual environment already exists in backend/venv');
  }

  // Step 2: Install Python Requirements
  log('2/5', 'Checking Python backend dependencies...');
  try {
    execSync(`"${venvPython}" -m pip install -r "${path.join(backendDir, 'requirements.txt')}"`, { stdio: 'inherit' });
    success('Backend dependencies installed');
  } catch (err) {
    warn('Pip installation note: ' + err.message);
  }

  // Step 3: Environment File
  log('3/5', 'Configuring environment settings (.env)...');
  const envFile = path.join(backendDir, '.env');
  const envExample = path.join(backendDir, '.env.example');
  if (!fs.existsSync(envFile) && fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, envFile);
    success('Created backend/.env from .env.example');
  } else {
    success('backend/.env is configured');
  }

  // Step 4: Check / Train Models
  trainModels(venvPython);

  // Step 5: Frontend Node modules
  log('5/5', 'Installing frontend Node.js packages...');
  try {
    if (!fs.existsSync(path.join(frontendDir, 'node_modules'))) {
      execSync('npm install', { cwd: frontendDir, stdio: 'inherit' });
      success('Frontend packages installed');
    } else {
      success('Frontend node_modules already installed');
    }
  } catch (err) {
    warn('npm install warning: ' + err.message);
  }

  console.log('\n\x1b[32m========================================================\x1b[0m');
  console.log('\x1b[1;32m   ✔ SETUP COMPLETE! Everything is ready to run.        \x1b[0m');
  console.log('\x1b[32m========================================================\x1b[0m\n');
  console.log('To start both the Backend and Frontend together, just run:\n');
  console.log('    \x1b[1;36mnpm run dev\x1b[0m\n');
  console.log('Then open: \x1b[4;34mhttp://localhost:5173\x1b[0m in your browser.\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSetup();
}
