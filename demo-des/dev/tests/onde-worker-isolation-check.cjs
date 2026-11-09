const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const origin = 'https://cgiy.github.io';
const repoPath = '/onde-a-deux/';
const repo = path.resolve(__dirname, '../../..');
const workers = [
  {file: 'service-worker.js', scope: '', prefix: 'onde-shell:', legacy: 'onde-v46'},
  {file: 'dist/service-worker.js', scope: 'dist/', prefix: 'onde-dist-shell:'},
  {file: 'en-vie-corps/service-worker.js', scope: 'en-vie-corps/', prefix: 'envie-corps-shell:', legacy: 'envie-corps-v3'}
];

function request(url, init) {
  const value = new Request(url, init);
  Object.defineProperty(value, 'mode', {value: 'navigate'});
  return value;
}

async function verifyWorker(worker) {
  const scopePath = repoPath + worker.scope;
  const scope = origin + scopePath;
  const ownedCachePrefix = worker.prefix + scopePath + ':';
  const handlers = new Map();
  const erased = [];
  const written = new Map();
  const ownShell = '<title>' + worker.file + '</title>';
  let online = false;
  let networkCacheControl = '';
  let claimed = false;

  const unrelatedCaches = [
    'desir-shell:' + repoPath + 'demo-des/:connected-0.4.1',
    'les-cartes-v44',
    ...workers.filter(other => other !== worker).map(other => other.prefix + repoPath + other.scope + ':1'),
    'onde-v45'
  ];
  const cache = {
    match: async key => {
      const url = typeof key === 'string' ? key : key.url;
      return url === scope + 'index.html' ? new Response(ownShell) : undefined;
    },
    put: async (key, response) => written.set(key.url, await response.text())
  };

  vm.runInNewContext(fs.readFileSync(path.join(repo, worker.file), 'utf8'), {
    URL,
    Response,
    self: {
      registration: {scope},
      clients: {claim: async () => { claimed = true; }},
      addEventListener: (type, handler) => handlers.set(type, handler)
    },
    caches: {
      keys: async () => [...unrelatedCaches, ownedCachePrefix + '1', ...(worker.legacy ? [worker.legacy] : [])],
      delete: async key => { erased.push(key); },
      open: async key => {
        assert.ok(key.startsWith(ownedCachePrefix), worker.file + ' opened another app’s cache');
        return cache;
      }
    },
    fetch: async () => {
      if (!online) throw new TypeError('Offline');
      return new Response('network', {headers: {'Cache-Control': networkCacheControl}});
    }
  });

  let activation;
  handlers.get('activate')({waitUntil: promise => { activation = promise; }});
  await activation;
  assert.ok(claimed);
  assert.deepEqual(erased, [ownedCachePrefix + '1', ...(worker.legacy ? [worker.legacy] : [])]);

  async function fetchEvent(value) {
    let response;
    const writes = [];
    handlers.get('fetch')({
      request: value,
      respondWith: promise => { response = promise; },
      waitUntil: promise => writes.push(promise)
    });
    const result = await response;
    await Promise.all(writes);
    return result;
  }

  for (const otherScope of ['demo-des/', 'cartes/', ...workers.filter(other => other !== worker).map(other => other.scope)]) {
    assert.equal(await fetchEvent(request(origin + repoPath + otherScope)), undefined, worker.file + ' intercepted a sibling app');
  }
  assert.equal(await fetchEvent(request(scope, {headers: {Authorization: 'Bearer local-fixture'}})), undefined);
  assert.equal(await fetchEvent(request('https://elsewhere.test' + scopePath)), undefined);
  assert.equal(await (await fetchEvent(request(scope + '?room=fixture'))).text(), ownShell);

  online = true;
  assert.equal(await (await fetchEvent(request(scope + 'index.html'))).text(), 'network');
  assert.equal(written.get(scope + 'index.html'), 'network');
  written.clear();
  networkCacheControl = 'private, no-store';
  assert.equal(await (await fetchEvent(request(scope))).text(), 'network');
  assert.equal(written.size, 0);
}

(async () => {
  for (const worker of workers) await verifyWorker(worker);
  console.log('D6 adjacent workers preserve isolated routes, cache cleanup and offline navigation.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
