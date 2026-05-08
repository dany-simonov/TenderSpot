import { spawn } from 'node:child_process';

function runParserOnce() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['dist/index.js', '--once'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
        return;
      }
      const error = new Error(`Parser exited with code ${code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      error.code = code;
      reject(error);
    });
  });
}

export default async ({ req, res, log, error }) => {
  try {
    const result = await runParserOnce();
    if (result.stdout) {
      log(result.stdout.trim());
    }
    if (result.stderr) {
      error(result.stderr.trim());
    }

    return res.json({
      success: true,
      message: 'Parsing completed',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const details = {
      message,
      code: err?.code,
      stdout: err?.stdout,
      stderr: err?.stderr,
    };

    if (stack) {
      error(stack);
    }
    error(JSON.stringify(details));

    return res.json({
      success: false,
      error: message,
      details,
    }, 500);
  }
};
