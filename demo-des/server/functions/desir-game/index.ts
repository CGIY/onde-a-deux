import './core.js';
import {PostgrestStore} from './store.mjs';
import {createHandler} from './server.mjs';
import * as push from './push.ts';

const url=Deno.env.get('SUPABASE_URL')||'';
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const store=new PostgrestStore(url,key);
const G=(globalThis as unknown as {OndeGame:unknown}).OndeGame;
const configuredOrigins=(Deno.env.get('DESIR_ALLOWED_ORIGINS')||'https://cgiy.github.io').split(',').map(value=>value.trim()).filter(Boolean);
const edgeRuntime=(globalThis as unknown as {EdgeRuntime?:{waitUntil:(promise:Promise<unknown>)=>void}}).EdgeRuntime;
Deno.serve(createHandler({G,store,push,rateSecret:Deno.env.get('DESIR_RATE_SECRET')||key,allowedOrigins:configuredOrigins,
  waitUntil:edgeRuntime?((promise:Promise<unknown>)=>edgeRuntime.waitUntil(promise)):undefined}));
