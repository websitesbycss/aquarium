/** Runs the same sync as POST /api/nessie/sync, from the command line. Run: npm run sync */
import { closePool } from '../lib/db';
import { syncNessie } from '../lib/sync';

syncNessie()
  .then((r) => console.log(JSON.stringify(r)))
  .catch((e) => {
    console.error('sync failed:', e.message);
    process.exitCode = 1;
  })
  .finally(closePool);
