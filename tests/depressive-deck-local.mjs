/* Local PostgreSQL/WASM only. Never connects to Supabase or reads live saves.
 * Install @electric-sql/pglite@0.5.12 into a temporary directory, then pass its package path.
 * node tests/depressive-deck-local.mjs /tmp/deck/node_modules/@electric-sql/pglite
 */
import {readFile} from 'node:fs/promises';
import {createDeckDatabase} from './deck-local-db.mjs';
const db=await createDeckDatabase(process.argv[2]);
let stage='event tests',sql='';
try {
  await db.exec('begin;');
  stage='event tests';sql=await readFile(new URL('./depressive-deck.sql',import.meta.url),'utf8');await db.exec(sql);
  await db.exec('rollback;');
  console.log('OK: local PostgreSQL integration, authentication, hidden state, normal rarity, one draw per profile, revision conflicts, pending lock, unique rewards, 20 misses → 10 Energies, 7+3, last-turn victory, post-deadline resume and closed starts. No production connection.');
} catch(error) {
  console.error(stage,error.message,error.detail||'',error.where||'',error.position||'',error.internalPosition||'',error.internalQuery||'');process.exitCode=1;
} finally { await db.close(); }
