// D11 diagnosis: one fresh process per run, timing the hook's start-up phases in the
// order runHook does them. No Jev call: route() is not run, only what precedes it.
const t = [['start', performance.now()]];
const mark = (name) => t.push([name, performance.now()]);
const dist = process.argv[2];
const { loadConfig, paths } = await import(`${dist}/config.js`); mark('import config');
const config = loadConfig(); mark('loadConfig');
const { scanLibrary } = await import(`${dist}/library.js`); mark('import library');
const library = scanLibrary(paths.library()); mark('scanLibrary');
const { route } = await import(`${dist}/route.js`); mark('import route');
const { promptContext } = await import(`${dist}/hook.js`); mark('import hook');
const { cachedEmbeddings } = await import(`${dist}/embed.js`); mark('import embed');
const store = config.embeddings ? await cachedEmbeddings(paths.embeddings()) : undefined; mark('cachedEmbeddings');
if (store) { await store.query('write playwright tests for the login page ' + process.pid); mark('first query embed'); }
if (store) { await store.query('review this vendor contract ' + process.pid); mark('second query embed'); }
const { repoSignals } = await import(`${dist}/repo.js`); repoSignals(process.cwd()); mark('repoSignals');
const out = { boot: Math.round(t[0][1]), skills: library.filter((c) => c.kind === 'skill').length, embeddings: Boolean(store) };
for (let i = 1; i < t.length; i++) out[t[i][0]] = Math.round(t[i][1] - t[i - 1][1]);
console.log(JSON.stringify(out));
