import { COMMENTS_CSS } from './style.js';

export const element = (document, tag, attributes = {}, text) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, value);
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
};

export function createCommentView({ document, container, t }) {
  const el = (tag, attrs, text) => element(document, tag, attrs, text);
  const host = el('ui-comments');
  host.dataset.uiDevmode = 'comments';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = el('style', {}, COMMENTS_CSS);
  const marks = el('div', {
    class: 'marks',
    'aria-label': t('Comments on objects'),
  });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  svg.append(path);
  const panel = el('section', {
    class: 'panel',
    'aria-label': t('UI comments'),
  });
  const status = el('output', { role: 'status', 'aria-live': 'polite' });
  const button = (action, label) =>
    el('button', { type: 'button', 'data-action': action }, t(label));
  const actions = el('div', { class: 'actions' });
  const pick = button('pick', 'Pick objects');
  const lasso = button('lasso', 'Lasso');
  pick.setAttribute('aria-pressed', 'true');
  lasso.setAttribute('aria-pressed', 'false');
  actions.append(
    pick,
    lasso,
    button('clear', 'Clear selection'),
    button('close', 'Close comments')
  );
  const objects = el('div', {
    class: 'objects',
    role: 'group',
    'aria-label': t('Select objects'),
  });
  const instruction = el('textarea', {
    'data-field': 'instruction',
    maxlength: '4000',
    'aria-label': t('Instruction for selected objects'),
  });
  const voice = button('voice', 'Start voice input');
  voice.setAttribute('aria-pressed', 'false');
  const create = el('div', { class: 'actions' });
  create.append(voice, button('add', 'Add tasks'));
  const tasks = el('div');
  const exchange = el('textarea', {
    'data-field': 'exchange',
    'aria-label': t('Comments as LiNo'),
    spellcheck: 'false',
  });
  const transfer = el('div', { class: 'actions' });
  transfer.append(
    button('export', 'Export LiNo'),
    button('copy', 'Copy LiNo'),
    button('import', 'Import LiNo')
  );
  panel.append(
    el('h2', {}, t('UI comments')),
    el(
      'p',
      {},
      t(
        'Pick an object. Shift/Ctrl/Cmd adds or removes objects. Draw a lasso, or use the checkboxes.'
      )
    ),
    actions,
    el('h3', {}, t('Selected objects')),
    objects,
    el('h3', {}, t('Change request')),
    instruction,
    el(
      'p',
      {},
      t(
        'Voice input uses your browser’s recognition service after you press Start. Review the text before adding tasks.'
      )
    ),
    create,
    status,
    el('h3', {}, t('Tasks')),
    tasks,
    el('h3', {}, t('Agent handoff')),
    exchange,
    transfer
  );
  shadow.append(style, marks, svg, panel);
  container.append(host);
  return {
    host,
    shadow,
    marks,
    path,
    panel,
    status,
    pick,
    lasso,
    objects,
    instruction,
    voice,
    tasks,
    exchange,
    t,
  };
}

export function renderObjects(view, nodes, selected) {
  const doc = view.host.ownerDocument;
  const old = view.objects.querySelectorAll('input');
  if (
    [...old].map((node) => node.dataset.target).join('\n') ===
    nodes.map((node) => node.id).join('\n')
  ) {
    old.forEach((input) => {
      input.checked = selected.has(input.dataset.target);
    });
    return;
  }
  view.objects.replaceChildren(
    ...nodes.map((node) => {
      const label = element(doc, 'label');
      const input = element(doc, 'input', {
        type: 'checkbox',
        'data-target': node.id,
      });
      input.checked = selected.has(node.id);
      label.append(input, doc.createTextNode(`${node.id}: ${node.kind}`));
      return label;
    })
  );
}

export function renderTasks(view, model, run) {
  const doc = view.host.ownerDocument;
  const t = view.t;
  view.tasks.replaceChildren(
    ...model.tasks().map((task) => {
      const card = element(doc, 'article', {
        class: 'task',
        'data-task': task.id,
        tabindex: '-1',
      });
      const input = element(doc, 'textarea', {
        'aria-label': `${t('Instruction')} ${task.id}`,
        maxlength: '4000',
      });
      input.value = task.instruction;
      const status = element(doc, 'input', {
        type: 'checkbox',
        'aria-label': `${t('Resolved')} ${task.id}`,
      });
      status.checked = task.status === 'resolved';
      const label = element(doc, 'label');
      label.append(status, doc.createTextNode(t('Resolved')));
      const save = element(doc, 'button', { type: 'button' }, t('Save task'));
      save.onclick = () =>
        run(() =>
          model.update(task.id, {
            instruction: input.value,
            status: status.checked ? 'resolved' : 'open',
          })
        );
      const remove = element(
        doc,
        'button',
        { type: 'button', 'aria-label': `${t('Delete')} ${task.id}` },
        t('Delete')
      );
      remove.onclick = () => run(() => model.remove(task.id));
      const buttons = element(doc, 'div', { class: 'actions' });
      buttons.append(save, remove);
      card.append(
        element(doc, 'strong', {}, `${task.id} · ${task.target}`),
        element(
          doc,
          'p',
          { class: 'meta' },
          `${task.revision} · ${t(model.state(task.id))} · ${task.input}`
        ),
        input,
        label,
        buttons
      );
      return card;
    })
  );
}

export function renderMarks(view, nodes, selected, model) {
  const doc = view.host.ownerDocument;
  const tasks = model.tasks();
  view.marks.replaceChildren();
  for (const { id, node } of nodes) {
    const comments = tasks.filter(
      (task) => task.target === id && task.status === 'open'
    );
    if (!node?.isConnected || (!selected.has(id) && !comments.length)) {
      continue;
    }
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      continue;
    }
    const mark = element(doc, 'div', {
      class: `mark${selected.has(id) ? ' selected' : ''}`,
      'aria-hidden': comments.length ? 'false' : 'true',
    });
    Object.assign(mark.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    if (comments.length) {
      const bubble = element(
        doc,
        'button',
        {
          type: 'button',
          class: 'bubble',
          'aria-label': `${view.t('Comment on')} ${id} (${comments.length}): ${comments[0].instruction.slice(0, 120)}`,
        },
        `${id} (${comments.length}): ${comments[0].instruction.slice(0, 120)}`
      );
      bubble.onclick = () => {
        const card = [...view.tasks.children].find(
          (el) => el.dataset.task === comments[0].id
        );
        card?.scrollIntoView?.({ block: 'nearest' });
        card?.focus();
      };
      mark.append(bubble);
    }
    view.marks.append(mark);
  }
}
