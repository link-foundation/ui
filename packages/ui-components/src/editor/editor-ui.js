/** Light DOM parts, using the existing controls and APG roving tabs helper. */
import { mountControls } from '../controls/index.js';
import { createRovingTabindex } from '../a11y/index.js';
import { formatLinks } from '@link-foundation/ui-core';
import { Link } from 'links-notation';
import { diagnosticOffset, validateLino } from './validate-lino.js';

const make = (doc, tag, attrs = {}, text) => {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
};

function buttons(parent, labels, click) {
  const source = formatLinks(
    labels.map(
      (label, index) =>
        new Link(`${parent.id}-action-${index}`, [
          new Link('button'),
          new Link(null, [new Link('label'), new Link(label)]),
        ])
    )
  );
  const mounted = mountControls(parent, source);
  [...parent.querySelectorAll('button')].forEach((button, index) =>
    button.addEventListener('click', () => click(index))
  );
  return mounted;
}

function updateTabs(tabs, panel, prefix, documents, current) {
  const doc = tabs.ownerDocument;
  const ids = new Set(documents.map((item) => item.id));
  for (const tab of [...tabs.children]) {
    if (!ids.has(tab.dataset.documentId)) {
      tab.remove();
    }
  }
  for (const item of documents) {
    let tab = [...tabs.children].find((t) => t.dataset.documentId === item.id);
    if (!tab) {
      tab = make(doc, 'button', {
        type: 'button',
        role: 'tab',
        id: `${prefix}-tab-${encodeURIComponent(item.id)}`,
        'aria-controls': panel.id,
      });
      tab.dataset.documentId = item.id;
      tabs.append(tab);
    }
    tab.textContent = `${item.title}${item.dirty ? ' •' : ''}`;
    tab.setAttribute('aria-selected', String(item.id === current?.id));
    tab.tabIndex = item.id === current?.id ? 0 : -1;
  }
  panel.hidden = !current;
  if (current) {
    panel.setAttribute(
      'aria-labelledby',
      `${prefix}-tab-${encodeURIComponent(current.id)}`
    );
  }
}

/** Create parts once so editing never replaces the focused editor or tab. */
export function createEditorUi(host, model, options) {
  const doc = host.ownerDocument;
  const label = options.label ?? host.getAttribute('label') ?? 'Source editor';
  const prefix = host.id || `ui-editor-${options.instance}`;
  const tabs = make(doc, 'div', { role: 'tablist', 'aria-label': 'Documents' });
  const toolbar = make(doc, 'div', {
    id: `${prefix}-toolbar`,
    class: 'ui-editor-toolbar',
    'aria-label': 'Document actions',
    role: 'group',
  });
  const panel = make(doc, 'div', { role: 'tabpanel', id: `${prefix}-panel` });
  const area = make(doc, 'div', { class: 'ui-editor-area' });
  const conflicts = make(doc, 'div', {
    class: 'ui-editor-conflict',
    role: 'region',
    'aria-label': 'Source changed',
    hidden: '',
  });
  const prompt = make(doc, 'p', {}, 'The source changed.');
  const actions = make(doc, 'div', { id: `${prefix}-conflict-actions` });
  conflicts.append(prompt, actions);
  const compare = make(doc, 'div', { class: 'ui-editor-compare', hidden: '' });
  const live = make(doc, 'div', {
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });
  const list = make(doc, 'ul', { 'aria-label': 'Diagnostics' });
  live.append(list);
  panel.append(conflicts, compare, area, live);
  host.replaceChildren(tabs, toolbar, panel);
  const mounts = [
    buttons(toolbar, ['Save', 'Close document'], (index) => {
      const current = model.active;
      if (!current) {
        return;
      }
      if (index === 0) {
        const text = model.save(current.id);
        host.dispatchEvent(
          new doc.defaultView.CustomEvent('ui-save', {
            bubbles: true,
            detail: { id: current.id, text },
          })
        );
      } else if (
        model.close(current.id) === 'unsaved' &&
        options.confirmClose(current)
      ) {
        model.close(current.id, { discard: true });
      }
    }),
    buttons(actions, ['Keep mine', 'Load theirs', 'Compare'], (index) => {
      if (index === 2) {
        showCompare(model.active);
        return;
      }
      model.resolve(model.active.id, index === 0 ? 'mine' : 'theirs');
      compare.hidden = true;
    }),
  ];
  const roving = createRovingTabindex(() => [...tabs.children], {
    onChange: (index, tab) => model.switch(tab.dataset.documentId),
  });
  const detach = roving.attach(tabs);
  tabs.addEventListener('click', (event) => {
    const tab = event.target.closest('[role=tab]');
    if (tab && tabs.contains(tab)) {
      roving.focus([...tabs.children].indexOf(tab));
    }
  });
  const showCompare = (current) => {
    compare.replaceChildren();
    for (const [title, text] of [
      ['Mine', current.text],
      ['Theirs', current.incoming],
    ]) {
      const section = make(doc, 'section', { 'aria-label': title });
      section.append(make(doc, 'h3', {}, title), make(doc, 'pre', {}, text));
      compare.append(section);
    }
    compare.hidden = false;
  };

  return {
    area,
    label,
    render() {
      const current = model.active;
      updateTabs(tabs, panel, prefix, model.documents, current);
      const controls = toolbar.querySelectorAll('button');
      controls[0].disabled = !current || current.incoming !== null;
      controls[1].disabled = !current;
      conflicts.hidden = !current || current.incoming === null;
      if (conflicts.hidden) {
        compare.hidden = true;
      } else if (!compare.hidden) {
        showCompare(current);
      }
      const diagnostics =
        current?.language === 'lino'
          ? validateLino(current.text).diagnostics
          : [];
      const summary = diagnostics
        .map((d) => `${d.line}:${d.column} ${d.message}`)
        .join('\n');
      if (list.dataset.summary !== summary) {
        list.dataset.summary = summary;
        list.replaceChildren(
          ...diagnostics.map((d) => {
            const item = make(doc, 'li');
            const button = make(
              doc,
              'button',
              { type: 'button' },
              `${d.line}:${d.column} ${d.message}`
            );
            button.addEventListener('click', () =>
              options.focus(diagnosticOffset(current.text, d))
            );
            item.append(button);
            return item;
          })
        );
      }
      host.dataset.dirty = String(current?.dirty ?? false);
      return diagnostics;
    },
    destroy() {
      detach();
      mounts.forEach((m) => m.destroy());
    },
  };
}
