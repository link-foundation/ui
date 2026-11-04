/** Versioned annotations are data, never executable application operations. */
import {
  format,
  formatLinks,
  parse,
  parseLinks,
} from '@link-foundation/ui-core';

export const COMMENT_LIMITS = Object.freeze({
  size: 1048576,
  tasks: 500,
  revisions: 100,
  events: 2000,
  instruction: 4000,
});
const TASK_FIELDS = [
  'target',
  'kind',
  'revision',
  'instruction',
  'input',
  'status',
];
const fail = (message) => {
  throw new Error(message);
};
const clone = (items) => items.map((item) => ({ ...item }));

/** Name anonymous objects with their actual adapter IDs in review snapshots. */
export function commentDocument(tree) {
  const byId = new Map();
  const walk = (id) => {
    const node = { ...tree.get(id), id, children: tree.children(id).map(walk) };
    byId.set(id, node);
    return node;
  };
  return { ...tree.toDocument(), roots: tree.roots().map(walk), byId };
}

function fields(values, allowed) {
  const result = {};
  for (const value of values) {
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      !allowed.includes(value[0]) ||
      typeof value[1] !== 'string' ||
      Object.hasOwn(result, value[0])
    ) {
      fail('Unknown, duplicate or invalid comment field');
    }
    result[value[0]] = value[1];
  }
  if (allowed.some((name) => !Object.hasOwn(result, name))) {
    fail('Missing comment field');
  }
  return result;
}

function instructionText(text) {
  if (
    typeof text !== 'string' ||
    !text.trim() ||
    text.length > COMMENT_LIMITS.instruction
  ) {
    fail('Instruction must contain 1–4000 characters');
  }
  return text;
}

function checkTask(task, revisions) {
  instructionText(task.instruction);
  if (!['text', 'voice'].includes(task.input)) {
    fail('Invalid input method');
  }
  if (!['open', 'resolved'].includes(task.status)) {
    fail('Invalid status');
  }
  const document = revisions.get(task.revision);
  if (
    !document?.byId.has(task.target) ||
    document.byId.get(task.target).kind !== task.kind
  ) {
    fail('Invalid target or revision');
  }
}

function snapshot(source) {
  const document = parse(source, { checks: false });
  if (
    document.diagnostics.some((d) => d.severity === 'error') ||
    !document.roots.length
  ) {
    fail('Invalid revision snapshot');
  }
  return document;
}

const isReview = (roots) =>
  roots.length === 1 &&
  Boolean(roots[0]?.id) &&
  roots[0]?.values?.[0] === 'ui-comments';

/** Strict bounded reader for the ui-comments/1 interchange format. */
export function readComments(text) {
  const roots = parseLinks(text, {
    maxInputSize: COMMENT_LIMITS.size,
    maxDepth: 80,
  });
  const root = roots[0];
  if (!isReview(roots)) {
    fail('Expected one ui-comments link');
  }
  const result = { revisions: [], tasks: [], events: [] };
  const seen = new Set(['ui-review', root.id]);
  let version = false;
  for (const value of root.values.slice(1)) {
    if (Array.isArray(value) && value[0] === 'version') {
      if (version || value.length !== 2 || value[1] !== '1') {
        fail('Invalid comments version');
      }
      version = true;
      continue;
    }
    if (!value?.id || seen.has(value.id)) {
      fail('Invalid or duplicate comment field');
    }
    seen.add(value.id);
    readEntry(result, value);
  }
  if (!version) {
    fail('Missing comments version');
  }
  validateData(result);
  return result;
}

function readEntry(result, value) {
  const [kind, ...values] = value.values ?? [];
  if (kind === 'revision') {
    const [source] = values;
    if (
      values.length !== 1 ||
      !Array.isArray(source) ||
      source[0] !== 'source' ||
      source.length < 2
    ) {
      fail('Invalid revision source');
    }
    result.revisions.push({
      id: value.id,
      source: formatLinks(source.slice(1)),
    });
  } else if (kind === 'task') {
    result.tasks.push({ id: value.id, ...fields(values, TASK_FIELDS) });
  } else if (kind === 'event') {
    const { task, action, ...data } = fields(values, [
      'task',
      'action',
      ...TASK_FIELDS,
    ]);
    result.events.push({ id: task, action, ...data });
  } else {
    fail('Unknown comment field');
  }
}
const freshId = (prefix, used) => {
  let i = 1;
  while (used.has(`${prefix}-${i}`)) {
    i += 1;
  }
  const id = `${prefix}-${i}`;
  used.add(id);
  return id;
};
const idsOf = (data) =>
  new Set([
    'ui-review',
    ...data.revisions.map((r) => r.id),
    ...data.events.map((e) => e.id),
  ]);

function validateData(data) {
  for (const name of ['tasks', 'revisions', 'events']) {
    if (data[name].length > COMMENT_LIMITS[name]) {
      fail(`Comment ${name} limit exceeded`);
    }
  }
  const revisions = new Map(
    data.revisions.map((r) => [r.id, snapshot(r.source)])
  );
  data.tasks.forEach((task) => checkTask(task, revisions));
  const replayed = new Map();
  const created = new Set();
  for (const { action, ...task } of data.events) {
    checkTask(task, revisions);
    const previous = replayed.get(task.id);
    if (
      previous &&
      ['target', 'kind', 'revision', 'input'].some(
        (key) => previous[key] !== task[key]
      )
    ) {
      fail('Immutable task history field');
    }
    if (action === 'create' && !created.has(task.id)) {
      created.add(task.id);
      replayed.set(task.id, task);
    } else if (action === 'update' && replayed.has(task.id)) {
      replayed.set(task.id, task);
    } else if (action === 'remove' && replayed.has(task.id)) {
      if (JSON.stringify(task) !== JSON.stringify(previous)) {
        fail('Removed task differs from history');
      }
      replayed.delete(task.id);
    } else {
      fail('Invalid comment event history');
    }
  }
  if (JSON.stringify([...replayed.values()]) !== JSON.stringify(data.tasks)) {
    fail('Comment history does not match tasks');
  }
}

const props = (object, names) => names.map((name) => [name, object[name]]);
function write(data) {
  const used = idsOf(data);
  return formatLinks([
    {
      id: 'ui-review',
      values: [
        'ui-comments',
        ['version', '1'],
        ...data.revisions.map((r) => ({
          id: r.id,
          values: ['revision', ['source', ...parseLinks(r.source)]],
        })),
        ...data.tasks.map((t) => ({
          id: t.id,
          values: ['task', ...props(t, TASK_FIELDS)],
        })),
        ...data.events.map((e) => ({
          id: freshId('event', used),
          values: [
            'event',
            ['task', e.id],
            ['action', e.action],
            ...props(e, TASK_FIELDS),
          ],
        })),
      ],
    },
  ]);
}

/** A deterministic model: batches validate completely before becoming visible. */
export function createComments({ getDocument, text, trace } = {}) {
  let data = text
    ? readComments(text)
    : { revisions: [], tasks: [], events: [] };
  const listeners = new Set();
  const commit = (next) => {
    validateData(next);
    if (write(next).length > COMMENT_LIMITS.size) {
      fail('Comment size limit exceeded');
    }
    const events = next.events.slice(data.events.length);
    data = next;
    for (const event of events) {
      trace?.('comment', { ...event });
    }
    listeners.forEach((listener) => listener());
  };
  const taskFor = (id) =>
    data.tasks.find((t) => t.id === id) ?? fail('Unknown task');
  return {
    tasks: () => clone(data.tasks),
    revisions: () => clone(data.revisions),
    events: () => clone(data.events),
    export: () => write(data),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    add(ids, instruction, input = 'text') {
      instructionText(instruction);
      const document = getDocument();
      const targets = [...new Set(ids)];
      if (!targets.length || targets.some((id) => !document.byId.has(id))) {
        fail('Select valid targets');
      }
      const source = format(document);
      const used = idsOf(data);
      const revision = data.revisions.find((r) => r.source === source) ?? {
        id: freshId('revision', used),
        source,
      };
      const tasks = targets.map((target) => ({
        id: freshId('task', used),
        target,
        kind: document.byId.get(target).kind,
        revision: revision.id,
        instruction,
        input,
        status: 'open',
      }));
      commit({
        revisions: data.revisions.includes(revision)
          ? data.revisions
          : [...data.revisions, revision],
        tasks: [...data.tasks, ...tasks],
        events: [
          ...data.events,
          ...tasks.map((task) => ({ ...task, action: 'create' })),
        ],
      });
      return clone(tasks);
    },
    update(id, patch) {
      if (
        Object.keys(patch).some(
          (key) => !['instruction', 'status'].includes(key)
        )
      ) {
        fail('Invalid task field');
      }
      const next = { ...taskFor(id), ...patch };
      commit({
        ...data,
        tasks: data.tasks.map((t) => (t.id === id ? next : t)),
        events: [...data.events, { ...next, action: 'update' }],
      });
    },
    remove(id) {
      const task = taskFor(id);
      commit({
        ...data,
        tasks: data.tasks.filter((t) => t.id !== id),
        events: [...data.events, { ...task, action: 'remove' }],
      });
    },
    state(id) {
      const task = taskFor(id);
      const document = getDocument();
      if (!document.byId.has(task.target)) {
        return 'missing';
      }
      return format(document) ===
        data.revisions.find((r) => r.id === task.revision).source
        ? 'current'
        : 'outdated';
    },
    import(text) {
      const next = readComments(text);
      data = next;
      listeners.forEach((listener) => listener());
    },
  };
}
