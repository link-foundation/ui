/**
 * A storage in an SQL table, for SQLite: `node:sqlite`'s `DatabaseSync`,
 * better-sqlite3, or any database with `exec(sql)` and `prepare(sql)`
 * returning statements with `run`, `get` and `all` (the shape both share).
 * Each call is one statement, so it runs inside the caller's transaction.
 */

import { ANY, BREAK, CONTINUE, NULL, constants } from './constants.js';
import {
  checkParts,
  isAddress,
  linkOf,
  LinksError,
  normalizeQuery,
  notFound,
} from './links.js';

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Open (and create when missing) the links table of `db`.
 * @param {{ exec(sql: string): unknown, prepare(sql: string): any }} db
 * @param {{ table?: string }} [options]
 */
export function createSqlLinks(db, { table = 'links' } = {}) {
  if (!IDENTIFIER.test(table)) {
    throw new LinksError('bad-request', `Not a table name: ${table}`);
  }
  db.exec(
    `CREATE TABLE IF NOT EXISTS ${table} (id INTEGER PRIMARY KEY, source INTEGER NOT NULL, target INTEGER NOT NULL);` +
      `CREATE INDEX IF NOT EXISTS ${table}_source ON ${table} (source);` +
      `CREATE INDEX IF NOT EXISTS ${table}_target ON ${table} (target);`
  );
  const statements = new Map();
  const statement = (sql) => {
    if (!statements.has(sql)) {
      statements.set(sql, db.prepare(sql));
    }
    return statements.get(sql);
  };
  const has = (id) =>
    isAddress(id) &&
    statement(`SELECT 1 AS found FROM ${table} WHERE id = ?`).get(id) !==
      undefined;
  /** The WHERE clause and parameters of a query. */
  const where = (query) => {
    const q = normalizeQuery(query);
    const clauses = [];
    const params = [];
    for (const [column, value] of [
      ['id', q.id],
      ['source', q.from_id],
      ['target', q.to_id],
    ]) {
      if (value !== ANY) {
        clauses.push(`${column} = ?`);
        params.push(value);
      }
    }
    return [clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', params];
  };
  return {
    constants,
    create() {
      const row = statement(
        `INSERT INTO ${table} (source, target) VALUES (?, ?) RETURNING id`
      ).get(NULL, NULL);
      return Number(row.id);
    },
    createAt(id) {
      if (!isAddress(id)) {
        throw new LinksError('bad-reference', `Not a link address: ${id}`);
      }
      if (has(id)) {
        throw new LinksError('exists', `Link ${id} exists`);
      }
      statement(
        `INSERT INTO ${table} (id, source, target) VALUES (?, ?, ?)`
      ).run(id, NULL, NULL);
      return id;
    },
    update(id, source, target) {
      if (!has(id)) {
        throw notFound(id);
      }
      checkParts(source, target);
      statement(`UPDATE ${table} SET source = ?, target = ? WHERE id = ?`).run(
        source,
        target,
        id
      );
      return id;
    },
    delete(id) {
      if (!has(id)) {
        throw notFound(id);
      }
      statement(`DELETE FROM ${table} WHERE id = ?`).run(id);
      return id;
    },
    count(query) {
      const [clause, params] = where(query);
      return Number(
        statement(`SELECT COUNT(*) AS n FROM ${table}${clause}`).get(...params)
          .n
      );
    },
    each(handler, query) {
      const [clause, params] = where(query);
      const rows = statement(
        `SELECT id, source, target FROM ${table}${clause} ORDER BY id`
      ).all(...params);
      for (const row of rows) {
        const link = linkOf(
          Number(row.id),
          Number(row.source),
          Number(row.target)
        );
        if (handler(link) === BREAK) {
          return BREAK;
        }
      }
      return CONTINUE;
    },
  };
}
