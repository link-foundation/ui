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
import { doubletColor } from '../doublet-colors.js';

export function notationPanel(parent, context) {
  const { doc, config, applyLinks, getState, run, message } = context;
  const panel = element(doc, 'fieldset', undefined, parent);
  element(doc, 'legend', message('notations'), panel);
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
    const input = field(doc, panel, message(`notation.${name}`));
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
        error.textContent = message(
          `notationError.${result.error}`,
          {},
          config.configurationMessages?.[context.locale]?.[result.error]
        );
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
      const count = state.links.length;
      summary.textContent = message('notationSummary', {
        count,
        base: count + 1,
        digits: 2 * count,
        networks: config.count(count),
      });
    },
  };
}

export function linksPanel(parent, context) {
  const { doc, config, getState, applyLinks, changeOptions, run, message } =
    context;
  const panel = element(doc, 'fieldset', undefined, parent);
  element(doc, 'legend', message('links'), panel);
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
      element(doc, 'legend', message('link', { index: i + 1 }), card);
      const reference = ['source', 'target'].map((end, e) => {
        const input = field(
          doc,
          card,
          message(`reference.${end}`, { index: i + 1 }),
          count > 50 ? 'number' : 'select'
        );
        if (count <= 50) {
          choices(
            doc,
            input,
            Array.from({ length: count + 1 }, (_, k) => [
              String(k),
              k === 0
                ? message('nothing')
                : k === i + 1
                  ? message('self', { index: k })
                  : String(k),
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
      const color = field(
        doc,
        card,
        message('linkColor', { index: i + 1 }),
        'color'
      );
      color.addEventListener('input', () =>
        run(() => {
          const values = [...getState().options.linkColors];
          while (values.length <= i) {
            values.push(null);
          }
          values[i] = color.value;
          return changeOptions({ linkColors: values });
        })
      );
      const turns = ['start', 'end'].map((end, e) => {
        const input = field(
          doc,
          card,
          message(`turn.${end}`, { index: i + 1 }),
          'number'
        );
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
        button(doc, card, message(`resetTurn.${end}`, { index: i + 1 }), () =>
          run(() => change(0))
        );
        return input;
      });
      const gaps = linkGapFields(card, i, context);
      const remove = button(
        doc,
        card,
        message('removeLink', { index: i + 1 }),
        () => run(() => context.removeLink(i + 1))
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
        const color = doubletColor(
          state.options,
          i + 1,
          state.options.linkColors[i]
        );
        set(record.color, swatch(color));
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

function linkGapFields(card, index, context) {
  const { doc, getState, changeOptions, run, message } = context;
  return ['startGap', 'endGap', 'middleBefore', 'middleAfter'].map(
    (name, g) => {
      const input = field(
        doc,
        card,
        message(name, { index: index + 1 }),
        'number'
      );
      input.min = '0';
      input.max = g < 2 ? '1' : '30';
      input.step = '0.01';
      input.placeholder = message('inherit');
      input.addEventListener('input', () =>
        run(() => {
          const values = getState().links.map((_, k) => [
            ...(getState().options.linkGaps[k] ?? [null, null, null, null]),
          ]);
          values[index][g] = input.value === '' ? null : Number(input.value);
          return changeOptions({ linkGaps: values });
        })
      );
      return input;
    }
  );
}

export function stylePanel(parent, context) {
  const { doc, getState, changeOptions, applyStyle, run, message } = context;
  const panel = element(doc, 'fieldset', undefined, parent);
  element(doc, 'legend', message('styles'), panel);
  const looks = field(doc, panel, message('look'), 'select');
  choices(doc, looks, [
    ['', message('chooseLook')],
    ...Object.keys(networkLooks).map((key) => [key, message(`look.${key}`)]),
  ]);
  looks.addEventListener('change', () => {
    if (looks.value) {
      run(() => applyStyle(networkLooks[looks.value]));
      looks.value = '';
    }
  });
  const sizes = field(doc, panel, message('size'), 'select');
  choices(doc, sizes, [
    ['', message('chooseSize')],
    ...networkSizePresets.map(([w, h]) => [
      `${w}x${h}`,
      message('sizePreset', { width: w, height: h }),
    ]),
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
      const section = message(`section.${definition.section}`);
      element(doc, 'legend', section, group);
      const reset = button(doc, group, message('reset', { section }), () => {
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
    const input = field(doc, group, message(`option.${definition.key}`), type);
    if (definition.choices) {
      choices(
        doc,
        input,
        definition.choices.map((v) => [
          v,
          message(`choice.${definition.key}.${v}`),
        ])
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
          input.value =
            f.type === 'color' ? swatch(options[f.key]) : options[f.key];
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
  const { doc, win, run, getState, applyStyle, announce, message } = context;
  const name = field(doc, parent, message('styleName'));
  name.maxLength = 80;
  const select = field(doc, parent, message('savedStyles'), 'select');
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
  button(doc, parent, message('saveStyle'), () =>
    run(() => {
      const key = name.value.trim();
      if (!key) {
        throw new Error(message('enterStyleName'));
      }
      const styles = read();
      styles.set(key, toOptions(getState().options));
      win.localStorage.setItem(
        storageKey,
        formatLinks([...styles].map(([id, text]) => ({ id, values: [text] })))
      );
      refresh();
      announce(message('styleSaved'));
    })
  );
  button(doc, parent, message('loadStyle'), () =>
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
    context.fail(error);
  }
  return { dispose() {} };
}

function linkActions(panel, context) {
  const { doc, config, getState, applyLinks, run, message } = context;
  const toolbar = element(doc, 'div', undefined, panel);
  button(doc, toolbar, message('addLink'), () =>
    run(() => applyLinks(config.addLink(getState().links)))
  );
  for (const [label, direction] of [
    ['previous', -1],
    ['next', 1],
  ]) {
    button(doc, toolbar, message(label), () =>
      run(() => applyLinks(config.step(getState().links, direction)))
    );
  }
  for (const real of [false, true]) {
    button(doc, toolbar, message(real ? 'randomReal' : 'random'), () =>
      run(() =>
        applyLinks(
          config.decode(config.randomCode(getState().links.length, { real }))
        )
      )
    );
  }
  return button(doc, toolbar, message('canonicalize'), () =>
    run(() => context.canonicalize())
  );
}

function swatch(color) {
  return color === 'currentColor' ? '#000000' : color;
}
