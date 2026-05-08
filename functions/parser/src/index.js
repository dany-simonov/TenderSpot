import { executeSync } from '../dist/run.js';

export default async ({ req, res, log, error }) => {
  try {
    log('Starting parser...');
    const result = await executeSync();
    log('Parsing finished.');
    return res.json({
      success: true,
      message: 'Parsing completed',
      result: result ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const details = { message };

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
