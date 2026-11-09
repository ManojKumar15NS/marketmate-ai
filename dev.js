const { spawn } = require('child_process');

console.log('Starting MarketMate AI Server and Client concurrently...\n');

const server = spawn('npm', ['run', 'dev'], {
  cwd: './server',
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: process.env.PORT || '5000' }
});

const client = spawn('npm', ['run', 'dev'], {
  cwd: './client',
  stdio: 'inherit',
  shell: true
});

function handleExit() {
  try { server.kill(); } catch {}
  try { client.kill(); } catch {}
  process.exit();
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
process.on('exit', handleExit);
