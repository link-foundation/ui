import { make } from '../layout/dom.js';
import { nextSort } from './sort-model.js';

/** Column records are parsed LiNo links: (name: column (label Name) ...). */
export function columnsOf(el) {
  return (el.props.get('columns') ?? [])
    .filter((value) => value && typeof value === 'object')
    .map((value) => {
      const values = value.values ?? value;
      const name = value.id ?? String(values[0]).replace(/:$/, '');
      const props = new Map(
        values.filter(Array.isArray).map(([key, ...value]) => [key, value])
      );
      return {
        name,
        label: props.get('label')?.[0] ?? name,
        sortable: props.get('sortable')?.[0] === 'true',
        align: props.get('align')?.[0] ?? 'start',
        width: Number(props.get('width')?.[0]) || 160,
      };
    });
}

/** Grid header cells also serve as keyboard-sort and resize targets. */
export function createTableHeader(state) {
  const { root, document } = state;
  const header = make(document, 'div', {
    class: 'ui-data-header',
    role: 'row',
    'aria-rowindex': 1,
  });
  root.append(header);
  const releases = new Set();
  function resize(cell, column, handle) {
    const setWidth = (width) => {
      state.widths.set(column.name, Math.max(48, width));
      state.refresh();
    };
    handle.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const width = state.widths.get(column.name) ?? column.width;
      setWidth(
        event.key === 'Home'
          ? 48
          : event.key === 'End'
            ? 600
            : width + (event.key === 'ArrowRight' ? 10 : -10)
      );
    });
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      handle.focus({ preventScroll: true });
      const x = event.clientX;
      const width = state.widths.get(column.name) ?? column.width;
      const move = (e) => setWidth(width + e.clientX - x);
      const release = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', release);
        document.removeEventListener('pointercancel', release);
        releases.delete(release);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', release);
      document.addEventListener('pointercancel', release);
      releases.add(release);
    });
  }
  function render() {
    state.columns.forEach((column, i) => {
      let cell = header.children[i];
      if (!cell || cell.dataset.column !== column.name) {
        const old = cell;
        cell = make(document, 'div', {
          role: 'columnheader',
          'data-column': column.name,
          'aria-colindex': i + 1,
        });
        const button = make(document, 'button', {
          type: 'button',
          'data-sort': column.name,
        });
        button.addEventListener('click', () => {
          if (!state.columns.find((c) => c.name === column.name)?.sortable) {
            return;
          }
          state.sort = nextSort(state.sort, column.name);
          state.refresh();
          state.send('sort', { column: column.name, ...state.sort });
        });
        button.tabIndex = -1;
        cell.append(button);
        const handle = make(document, 'span', {
          role: 'separator',
          tabindex: 0,
          'aria-orientation': 'vertical',
          'aria-label': `Resize ${column.label}`,
          'aria-valuemin': 48,
          class: 'ui-data-resize',
        });
        resize(cell, column, handle);
        cell.append(handle);
        if (old) {
          old.replaceWith(cell);
        } else {
          header.append(cell);
        }
      }
      const direction =
        state.sort?.column === column.name ? state.sort.direction : 'none';
      if (column.sortable) {
        cell.setAttribute('aria-sort', direction);
      } else {
        cell.removeAttribute('aria-sort');
      }
      cell.firstChild.setAttribute('aria-disabled', String(!column.sortable));
      cell.firstChild.tabIndex = state.inHeader && i === state.cell ? 0 : -1;
      cell.firstChild.textContent = `${column.label}${direction === 'ascending' ? ' ↑' : direction === 'descending' ? ' ↓' : ''}`;
      cell.lastChild.setAttribute(
        'aria-valuenow',
        state.widths.get(column.name) ?? column.width
      );
    });
    while (header.children.length > state.columns.length) {
      header.lastChild.remove();
    }
    root.setAttribute('aria-colcount', state.columns.length);
  }
  return { header, render, disconnect: () => releases.forEach((fn) => fn()) };
}

export function drawCells(state, row, item, index) {
  row.style.gridTemplateColumns = state.trackSizes();
  state.columns.forEach((column, i) => {
    let cell = row.children[i];
    if (!cell) {
      cell = make(state.document, 'div', { role: 'gridcell' });
      row.append(cell);
    }
    cell.setAttribute('aria-colindex', i + 1);
    cell.tabIndex =
      !state.inHeader && String(item.id) === state.active && i === state.cell
        ? 0
        : -1;
    cell.dataset.cell = i;
    cell.style.textAlign = column.align;
    cell.textContent = String(item[column.name] ?? '');
  });
  while (row.children.length > state.columns.length) {
    row.lastChild.remove();
  }
  row.setAttribute('aria-rowindex', index + 2);
}
