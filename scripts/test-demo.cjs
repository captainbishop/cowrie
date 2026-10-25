const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = require('node:path').resolve(__dirname, '../web');
const reproduceBaseline = process.argv.includes('--baseline');
const ts = require(root + '/node_modules/typescript');
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const current = path => fs.readFileSync(root + '/' + path, 'utf8');
const baseline = path => execFileSync('git', ['show', 'HEAD:web/' + path], { cwd: root, encoding: 'utf8' });
async function parse(source, text, intent, history = []) {
  const exports = {};
  const sandbox = { exports, require: () => ({ NextResponse: { json: data => data } }), process: { env: { LLM_API_KEY: 'test', LLM_BASE_URL: 'https://model.test', LLM_MODEL: 'test' } }, console, setTimeout, clearTimeout, AbortController,
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(intent) } }] }) }) };
  vm.runInNewContext(compile(source), sandbox);
  return (await exports.POST({ json: async () => ({ text, history, name: 'Tester', lang: 'English' }) })).intent;
}

const regressions = [
  ['a bare demo topic asks a question', 'Demo', { action: 'watchDemo' }, 'reply'],
  ['Ajo video remains a video', 'Watch the Ajo video', { action: 'watchDemo', variant: 'cre', message: 'Follow an Ajo circle through both payouts.' }, 'watchDemo'],
  ['Ajo payout walkthrough stays read-only', 'Show the Ajo video where members collect the payout', { action: 'watchDemo', variant: 'cre' }, 'watchDemo'],
];
(async () => {
  let baselineFailures = 0, passed = 0;
  for (const [label, text, intent, action] of regressions) {
    if (reproduceBaseline && (await parse(baseline('app/api/parse/route.ts'), text, intent)).action !== action) baselineFailures++;
    assert.equal((await parse(current('app/api/parse/route.ts'), text, intent)).action, action, label);
    passed++;
  }
  if (reproduceBaseline) assert.equal(baselineFailures, regressions.length, 'Each regression must fail against HEAD');
  const scenarios = [
    ['Watch the product tour', { action: 'watchDemo', variant: 'product', message: 'Here is how payments work.' }, [], 'watchDemo'],
    ['yes please', { action: 'watchDemo' }, [], 'reply'],
    ['yes please', { action: 'watchDemo' }, [{ role: 'assistant', content: 'Would you like the product tour or Ajo automation?' }], 'reply'],
    ['yes please', { action: 'watchDemo' }, [{ role: 'assistant', content: 'Would you like to watch the product tour?' }], 'watchDemo'],
    ['pay my ajo', { action: 'send', amount: 100 }, [], 'ajoDo'],
    ['pay my ajo', { action: 'reply', message: 'I can help.' }, [], 'ajoDo'],
    ['Do you show a video every time I say demo?', { action: 'reply', message: 'I should use the conversation to understand your request.' }, [], 'reply'],
  ];
  for (const [text, intent, history, action] of scenarios) {
    const result = await parse(current('app/api/parse/route.ts'), text, intent, history);
    assert.equal(result.action, action, text);
    if (action === 'watchDemo' && intent.message) assert.equal(result.message, intent.message);
    passed++;
  }
  assert.ok(!current('app/demo/page.tsx').includes('ThemeSwitch'), 'Demo inherits appearance without duplicate controls');
  passed++;
  const script = current('app/layout.tsx').match(/__html: `([^`]+)`/)[1];
  for (const saved of ['light', 'dark', 'system', null, 'invalid']) {
    for (const dark of [true, false]) {
      const document = { documentElement: { dataset: {} } };
      vm.runInNewContext(script, { document, localStorage: { getItem: () => saved }, window: { matchMedia: () => ({ matches: dark }) } });
      assert.equal(document.documentElement.dataset.theme, saved === 'dark' || saved === 'light' ? saved : dark ? 'dark' : 'light');
      passed++;
    }
  }
  const document = { documentElement: { dataset: {} } };
  vm.runInNewContext(script, { document, localStorage: { getItem: () => { throw Error('blocked storage'); } }, window: { matchMedia: () => ({ matches: true }) } });
  assert.equal(document.documentElement.dataset.theme, 'dark');
  passed++;

  // Exercise the actual provider's effects with a small hook harness.
  const state = [], effects = [], cleanup = [], deps = [];
  let index = 0, dirty = false, context, saved = 'dark';
  const listeners = {}, mediaListeners = new Set();
  const media = { matches: false, addEventListener: (_, fn) => mediaListeners.add(fn), removeEventListener: (_, fn) => mediaListeners.delete(fn) };
  const react = {
    createContext: () => (context = { Provider: 'provider' }), useContext: () => context.value,
    useState: initial => { const i = index++; if (!(i in state)) state[i] = initial; return [state[i], value => { if (state[i] !== value) { state[i] = value; dirty = true; } }]; },
    useEffect: (fn, next) => { const i = index++; if (!deps[i] || next.some((x, n) => x !== deps[i][n])) { effects.push(() => { cleanup[i]?.(); cleanup[i] = fn(); }); deps[i] = next; } },
  };
  const exported = {};
  vm.runInNewContext(compile(current('app/ThemeProvider.tsx')), { exports: exported, document,
    localStorage: { getItem: () => saved, setItem: (_, value) => { saved = value; } },
    window: { matchMedia: () => media, addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener: type => { delete listeners[type]; } },
    require: name => name === 'react' ? react : { jsx: (type, props) => { if (type === 'provider') context.value = props.value; return props; }, jsxs: (_, props) => props },
  });
  function render() { do { dirty = false; index = 0; exported.ThemeProvider({ children: null }); while (effects.length) effects.shift()(); } while (dirty); }
  render();
  assert.equal(document.documentElement.dataset.theme, 'dark');
  assert.equal(saved, 'dark', 'Mount must not overwrite preference');
  context.value.changeTheme('light'); render(); assert.equal(saved, 'light'); assert.equal(document.documentElement.dataset.theme, 'light');
  context.value.changeTheme('system'); render(); assert.equal(document.documentElement.dataset.theme, 'light');
  media.matches = true; mediaListeners.forEach(fn => fn()); assert.equal(document.documentElement.dataset.theme, 'dark');
  listeners.storage({ key: 'cowrie.theme', newValue: 'light' }); render(); assert.equal(context.value.theme, 'light'); assert.equal(document.documentElement.dataset.theme, 'light');
  listeners.storage({ key: null, newValue: null }); render(); assert.equal(context.value.theme, 'system'); assert.equal(document.documentElement.dataset.theme, 'dark');
  cleanup.filter(Boolean).forEach(fn => fn()); assert.equal(mediaListeners.size, 0); assert.equal(Object.keys(listeners).length, 0);
  passed += 7;
  console.log(`${reproduceBaseline ? baselineFailures + ' regressions reproduced against HEAD. ' : ''}${passed} current behavior checks passed (routing, pre-paint theme, provider updates and cleanup).`);
})().catch(error => { console.error(error); process.exitCode = 1; });
