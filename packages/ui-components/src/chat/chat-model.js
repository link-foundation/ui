/**
 * Pure display shaping adapted from meta-sovereign's Unlicense chat-model.
 * Provider receipt counters stay in host adapters; the contract has explicit
 * unread and delivery values. Dates use an injected clock and time zone.
 */
export const CHAT_FILTERS = Object.freeze(['all', 'unread']);
export const DAY_GROUPS = Object.freeze([
  'today',
  'yesterday',
  'week',
  'older',
]);
const time = (m) => Date.parse(m?.time ?? '') || 0;

/** Stable chronological sort, pinned first for the latest order. */
export function sortChats(chats, order = 'latest') {
  return [...chats].sort((a, b) => {
    if (order === 'latest' && (a.pinned || b.pinned)) {
      return (a.pinned || Infinity) - (b.pinned || Infinity);
    }
    return (order === 'oldest' ? 1 : -1) * (time(a.last) - time(b.last));
  });
}

/** A supplied unread snapshot wins; otherwise count explicit incoming marks. */
export function unreadCount(messages, chat = {}) {
  return chat.unread ?? messages.filter((m) => m.unread && !m.outgoing).length;
}

/** Explicit transport-independent delivery, including pending and failure. */
export function deliveryStatus(message) {
  if (!message.outgoing) {
    return null;
  }
  return message.status ?? 'pending';
}

/** A local calendar day as an ordinal; avoids 24-hour DST arithmetic. */
export function calendarDay(iso, timeZone = 'UTC') {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return (
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) /
    86400000
  );
}

/** Calendar days with injected time, including DST transitions. */
export function dayGroup(iso, { clock, timeZone = 'UTC' }) {
  const day = calendarDay(iso, timeZone);
  if (day === null) {
    return 'older';
  }
  const distance = calendarDay(clock(), timeZone) - day;
  return distance === 0
    ? 'today'
    : distance === 1
      ? 'yesterday'
      : distance > 1 && distance <= 6
        ? 'week'
        : 'older';
}

export function dayLabel(
  iso,
  { clock, locale = 'en', timeZone = 'UTC', labels = {} }
) {
  const group = dayGroup(iso, { clock, timeZone });
  return (
    labels[group] ??
    new Intl.DateTimeFormat(locale, { timeZone, dateStyle: 'medium' }).format(
      new Date(iso)
    )
  );
}

export function summarizeChats(data, options = {}) {
  const groups = new Map(
    data
      .filter((r) => r.kind === 'chat')
      .map((r) => [r.id, { ...r, messages: [] }])
  );
  for (const message of data.filter((r) => r.kind === 'message')) {
    groups.get(message.chat)?.messages.push(message);
  }
  return sortChats(
    [...groups.values()].map(({ messages, ...chat }) => ({
      ...chat,
      last: [...messages].sort((a, b) => time(a) - time(b)).at(-1) ?? null,
      unread: unreadCount(messages, chat),
    }))
  ).filter((chat) => options.filter !== 'unread' || chat.unread > 0);
}

/** Consecutive sender runs break on day, service line or a time gap. */
export function messageRuns(messages, { gap = 300000, timeZone = 'UTC' } = {}) {
  const runs = [];
  for (const message of messages) {
    const last = runs.at(-1)?.messages.at(-1);
    if (
      !last ||
      last.sender !== message.sender ||
      last.service ||
      message.service ||
      time(message) - time(last) > gap ||
      calendarDay(message.time, timeZone) !== calendarDay(last.time, timeZone)
    ) {
      runs.push({ sender: message.sender, messages: [] });
    }
    runs.at(-1).messages.push(message);
  }
  return runs;
}
