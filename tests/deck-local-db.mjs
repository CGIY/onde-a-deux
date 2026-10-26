/* Disposable local database. Uses committed schema/catalogue, never a remote dump. */
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export async function createDeckDatabase(lib=process.env.TCG_PGLITE_DIR||'/private/tmp/onde-tcg-pglite/node_modules/@electric-sql/pglite') {
  lib=resolve(lib);
  const {PGlite}=await import(pathToFileURL(`${lib}/dist/index.js`));
  const {pgcrypto}=await import(pathToFileURL(`${lib}/dist/contrib/pgcrypto.js`));
  const db=new PGlite({extensions:{pgcrypto}});
  try {
    await db.exec('create role anon; create role authenticated; create schema extensions;');
    const base=execFileSync('git',['show','7c2201cb2a09f9a500fb1151b64cc1271c4dbe7b:supabase/tcg_cards.sql'],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8'});
    await db.exec(base);
    await db.exec(await readFile(new URL('../supabase/migrations/20261026180958_depressive_deck_one_shot.sql',import.meta.url),'utf8'));
    return db;
  } catch(error) { await db.close();throw error; }
}
