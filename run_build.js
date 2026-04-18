import { spawn } from 'node:child_process';

const CWD = 'C:\\Users\\AI\\Documents\\WorkBuddy\\DuckAI-Export';
const WXT_BIN = 'C:\\Users\\AI\\Documents\\WorkBuddy\\DuckAI-Export\\node_modules\\.bin\\wxt.cmd';
const NODE_BIN = 'C:\\Users\\AI\\.workbuddy\\binaries\\node\\versions\\22.12.0.installing.11448.__extract_temp__\\node-v22.12.0-win-x64\\node.exe';

async function run(cmd, args) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: CWD,
      env: { ...process.env, PATH: `C:\\Users\\AI\\.workbuddy\\binaries\\node\\versions\\22.12.0.installing.11448.__extract_temp__\\node-v22.12.0-win-x64;${process.env.PATH}` },
      shell: true,
    });
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { out += d.toString(); });
    proc.on('close', (code) => {
      console.log(out);
      resolve({ out, code });
    });
  });
}

console.log('Building Firefox MV3 extension...');
const result = await run(NODE_BIN, [WXT_BIN.replace('\\.bin\\wxt.cmd', '\\wxt\\bin\\wxt.mjs'), 'build', '-b', 'firefox', '--mv3']);
console.log('Exit code:', result.code);
