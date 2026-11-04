import { loadConfig, resolveApiKey } from '../src/config.js';
import { isEntry } from './lib.js';
import { assertNoSecrets, heldSecrets } from './redact.js';

if (isEntry(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('usage: scan-secrets.ts <results directory>');
    const secrets = heldSecrets(resolveApiKey(loadConfig()));
    assertNoSecrets(process.argv[2]!, secrets);
    console.log('Results secret scan passed.');
  } catch (error) {
    console.error(error instanceof Error && error.message.startsWith('UNUSABLE:') ? error.message : 'Results secret scan could not run.');
    process.exitCode = 1;
  }
}
