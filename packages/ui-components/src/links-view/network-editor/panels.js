import {
  networkOptionSchema,
  normalize,
  optionAvailable,
  toOptions,
  fromOptions,
} from './options.js';
import { networkLooks, networkSizePresets } from './presets.js';
import { parseNested, formatLinks } from '@link-foundation/ui-core';
import { element, button, field, choices } from './dom.js';

export function notationPanel(parent, context) {
  const { doc, config, applyLinks, getState, run } = context;
  const panel = element(doc, 'fieldset', undefined, parent);
  element(doc, 'legend', 'Notations', panel);
  const summary = element(doc, 'p', undefined, panel);
  const inputs = new Map();
  const definitions = [
    ['theory', config.parseTheory, config.formatTheory],
    ['pairs', config.parseCode, config.encode],
    ['number', config.parseNumber, config.formatNumber],
    [
      'decimal',
      (text) => config.parseDecimal(text, getState().links.length),
      config.formatDecimal,
    ],
    [
      'links',
      config.parseLinks,
      (links) =>
        formatLinks(
          links.map(([s, t], i) => ({
            id: String(i + 1),
            values: [String(s), String(t)],
          })),
          { style: 'inline' }
        )
          .trim()
          .split('\n')
          .join(' '),
    ],
  ];
  for (const [name, parse, format] of definitions) {
    const input = field(doc, panel, name);
    input.autocomplete = 'off';
    input.spellcheck = false;
    const error = element(doc, 'span', undefined, input.parentNode);
    error.setAttribute('role', 'alert');
    error.id = `${context.id}-${name}-error`;
    input.setAttribute('aria-describedby', error.id);
    input.addEventListener('input', () => {
      context.draft = { name, code: getState().code };
      const result = parse(input.value);
      if (result.error) {
        input.setAttribute('aria-invalid', 'true');
        error.textContent =
          config.configurationMessages?.[context.locale]?.[result.error] ??
          result.error;
      } else {
        input.removeAttribute('aria-invalid');
        error.textContent = '';
        context.draft = { name, code: config.encode(result.links) };
        run(() => applyLinks(result.links));
      }
    });
    inputs.set(name, { input, error, format });
  }
  return {
    refresh(external = false) {
      const state = getState();
      if (external || (context.draft && context.draft.code !== state.code)) {
        context.draft = null;
      }
      for (const [name, record] of inputs) {
        if (!external && context.draft?.name === name) {
          continue;
        }
        record.input.value = record.format(state.links);
        record.input.removeAttribute('aria-invalid');
        record.error.textContent = '';
      }
      summary.textContent = `n = ${state.links.length} · base ${state.links.length + 1} · ${2 * state.links.length} digits · one of ${config.count(state.links.length)} networks`;
    },
  };
}

export function linksPanel(parent, context) {
  const { doc, config, getState, applyLinks, changeOptions, run } = context;
  const panel = element(doc, 'fieldset', undefined, parent);
  element(doc, 'legend', 'Links', panel);
  const canonical = linkActions(panel, context);
  const cards = element(doc, 'div', undefined, panel);
  let count = -1;
  let controls = [];
  function build() {
    cards.replaceChildren();
    controls = [];
    const state = getState();
    count = state.links.length;
    for (let i = 0; i < count; i++) {
      const card = element(doc, 'fieldset', undefined, cards);
      element(doc, 'legend', `Link ${i + 1}`, card);
      const reference = ['source', 'target'].map((end, e) => {
        const input = field(
          doc,
          card,
          `${end} ${i + 1}`,
          count > 50 ? 'number' : 'select'
        );
        if (count <= 50) {
          choices(
            doc,
            input,
            Array.from({ length: count + 1 }, (_, k) => [
              String(k),
              k === 0 ? '0 — nothing' : k === i + 1 ? `${k} — self` : String(k),
            ])
          );
        } else {
          input.min = '0';
          input.max = String(count);
          input.step = '1';
        }
        input.addEventListener('input', () =>
          run(() =>
            applyLinks(
              config.setReference(
                getState().links,
                i + 1,
                e,
                Number(input.value)
              )
            )
          )
        );
        return input;
      });
      const color = field(doc, card, `colour ${i + 1}`, 'color');
      color.addEventListener('input', () =>
        run(() => {
          const values = [...getState().options.linkColors];
          while (values.length <= i) {
            values.push(null);
          }
          values[i] = color.value;
          return changeOptions({ linkColors: values, palette: 'custom' });
        })
      );
      const turns = ['start', 'end'].map((end, e) => {
        const input = field(doc, card, `${end} turn ${i + 1}`, 'number');
        input.min = '-180';
        input.max = '180';
        input.step = '1';
        const change = (value) => {
          const values = getState().links.map((_, k) => [
            ...(getState().options.turns[k] ?? [0, 0]),
          ]);
          values[i][e] = value;
          return changeOptions({ turns: values });
        };
        input.addEventListener('input', () =>
          run(() => change(Number(input.value)))
        );
        button(doc, card, `Reset ${end} turn ${i + 1}`, () =>
          run(() => change(0))
        );
        return input;
      });
      const gaps = [
        'start gap',
        'end gap',
        'cut before middle',
        'cut after middle',
      ].map((name, g) => {
        const input = field(doc, card, `${name} ${i + 1}`, 'number');
        input.min = '0';
        input.max = g < 2 ? '1' : '30';
        input.step = '0.01';
        input.placeholder = 'inherit';
        input.addEventListener('input', () =>
          run(() => {
            const values = getState().links.map((_, k) => [
              ...(getState().options.linkGaps[k] ?? [null, null, null, null]),
            ]);
            values[i][g] = input.value === '' ? null : Number(input.value);
            return changeOptions({ linkGaps: values });
          })
        );
        return input;
      });
      const remove = button(doc, card, `Remove link ${i + 1}`, () =>
        run(() => context.removeLink(i + 1))
      );
      remove.disabled = count === 1;
      controls.push({ reference, color, turns, gaps });
    }
  }
  return {
    refresh() {
      const state = getState();
      if (count !== state.links.length) {
        build();
      }
      canonical.disabled = state.links.length > 7;
      controls.forEach((record, i) => {
        const set = (input, value) => {
          if (
            doc.activeElement !== input &&
            input.getRootNode().activeElement !== input
          ) {
            input.value = value;
          }
        };
        record.reference.forEach((input, e) => set(input, state.links[i][e]));
        set(record.color, state.options.linkColors[i] ?? state.options.color);
        record.turns.forEach((input, e) =>
          set(input, state.options.turns[i]?.[e] ?? 0)
        );
        record.gaps.forEach((input, g) =>
          set(input, state.options.linkGaps[i]?.[g] ?? '')
        );
      });
    },
  };
}

export function stylePanel(parent, context) {
  const { doc, getState, changeOptions, applyStyle, run } = context;
  const panel = element(doc, 'fieldset', undefined, parent);
  element(doc, 'legend', 'Style', panel);
  const looks = field(doc, panel, 'Look', 'select');
  choices(doc, looks, [
    ['', 'Choose a look'],
    ...Object.keys(networkLooks).map((key) => [
      key,
      key === 'social' ? 'social 1200×630' : key,
    ]),
  ]);
  looks.addEventListener('change', () => {
    if (looks.value) {
      run(() => applyStyle(networkLooks[looks.value]));
      looks.value = '';
    }
  });
  const sizes = field(doc, panel, 'Size', 'select');
  choices(doc, sizes, [
    ['', 'Choose a size'],
    ...networkSizePresets.map(([w, h]) => [`${w}x${h}`, `${w}×${h}`]),
  ]);
  sizes.addEventListener('change', () => {
    if (sizes.value) {
      const [width, height] = sizes.value.split('x').map(Number);
      run(() => changeOptions({ width, height }));
      sizes.value = '';
    }
  });
  const sections = new Map(),
    controls = [];
  for (const definition of networkOptionSchema) {
    if (!sections.has(definition.section)) {
      const group = element(doc, 'fieldset', undefined, panel);
      element(doc, 'legend', definition.section, group);
      const reset = button(doc, group, `Reset ${definition.section}`, () => {
        const defaults = normalize({});
        run(() =>
          changeOptions(
            Object.fromEntries(
              networkOptionSchema
                .filter((f) => f.section === definition.section)
                .map((f) => [f.key, defaults[f.key]])
            )
          )
        );
      });
      sections.set(definition.section, { group, reset });
    }
    const group = sections.get(definition.section).group;
    const type = {
      choice: 'select',
      boolean: 'checkbox',
      number: 'range',
      color: 'color',
      text: 'text',
    }[definition.type];
    const input = field(doc, group, definition.key, type);
    if (definition.choices) {
      choices(
        doc,
        input,
        definition.choices.map((v) => [v, v])
      );
    }
    if (type === 'range') {
      input.min = definition.min;
      input.max = definition.max;
      input.step = definition.step;
    }
    const output =
      type === 'range'
        ? element(doc, 'span', undefined, input.parentNode)
        : null;
    input.addEventListener('input', () =>
      run(() =>
        changeOptions({
          [definition.key]:
            type === 'checkbox'
              ? input.checked
              : type === 'range'
                ? Number(input.value)
                : input.value,
          ...(type === 'color' ? { palette: 'custom' } : {}),
        })
      )
    );
    controls.push({ definition, input, output });
  }
  const storage = savedStyles(panel, context);
  return {
    refresh() {
      const { links, options } = getState();
      const defaults = normalize({});
      for (const { definition: f, input, output } of controls) {
        input.parentNode.hidden = !optionAvailable(f, links, options);
        if (f.type === 'boolean') {
          input.checked = options[f.key];
        } else {
          input.value = options[f.key];
        }
        if (output) {
          output.textContent = String(options[f.key]);
        }
      }
      for (const [section, { reset }] of sections) {
        reset.disabled = networkOptionSchema
          .filter((f) => f.section === section)
          .every((f) => options[f.key] === defaults[f.key]);
      }
    },
    dispose: storage.dispose,
  };
}

function savedStyles(parent, context) {
  const { doc, win, run, getState, applyStyle, announce } = context;
  const name = field(doc, parent, 'Style name');
  name.maxLength = 80;
  const select = field(doc, parent, 'Saved styles', 'select');
  const storageKey = 'links-network-editor-styles';
  function read() {
    const text = win.localStorage.getItem(storageKey) ?? '';
    return new Map(
      parseNested(text)
        .filter((v) => v.id !== null && v.values.length === 1)
        .map((v) => [v.id, v.values[0].id])
    );
  }
  function refresh() {
    select.replaceChildren();
    choices(
      doc,
      select,
      [...read()].map(([key]) => [key, key])
    );
  }
  button(doc, parent, 'Save style', () =>
    run(() => {
      const key = name.value.trim();
      if (!key) {
        throw new Error('Enter a style name');
      }
      const styles = read();
      styles.set(key, toOptions(getState().options));
      win.localStorage.setItem(
        storageKey,
        formatLinks([...styles].map(([id, text]) => ({ id, values: [text] })))
      );
      refresh();
      announce('Style saved');
    })
  );
  button(doc, parent, 'Load style', () =>
    run(() => {
      const text = read().get(select.value);
      if (text !== undefined) {
        return applyStyle(fromOptions(text));
      }
    })
  );
  try {
    refresh();
  } catch (error) {
    announce(error.message, true);
  }
  return { dispose() {} };
}

function linkActions(panel, context) {
  const { doc, config, getState, applyLinks, run } = context;
  const toolbar = element(doc, 'div', undefined, panel);
  button(doc, toolbar, 'Add link', () =>
    run(() => applyLinks(config.addLink(getState().links)))
  );
  for (const [label, direction] of [
    ['Previous', -1],
    ['Next', 1],
  ]) {
    button(doc, toolbar, label, () =>
      run(() => applyLinks(config.step(getState().links, direction)))
    );
  }
  for (const real of [false, true]) {
    button(doc, toolbar, real ? 'Random real links' : 'Random', () =>
      run(() =>
        applyLinks(
          config.decode(config.randomCode(getState().links.length, { real }))
        )
      )
    );
  }
  return button(doc, toolbar, 'Canonical renaming', () =>
    run(() => context.canonicalize())
  );
}
