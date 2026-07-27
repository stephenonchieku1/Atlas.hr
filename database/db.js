'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');

const DB_PATH     = path.join(__dirname, 'hr_payroll.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let _db = null;

class Stmt {
  constructor(stmt) { this._s = stmt; }

  _resolve(args) {
    if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      return [args[0]];
    }
    return args;
  }

  run(...args) {
    const r = this._s.run(...this._resolve(args));
    return { lastInsertRowid: r.lastInsertRowid, changes: r.changes };
  }

  get(...args) {
    const row = this._s.get(...this._resolve(args));
    return row ?? null;
  }

  all(...args) {
    return this._s.all(...this._resolve(args));
  }
}

class DB {
  constructor(path) {
    this._db = new DatabaseSync(path);
  }

  pragma(str) {
    this._db.exec(`PRAGMA ${str}`);
  }

  exec(sql) {
    this._db.exec(sql);
  }

  prepare(sql) {
    return new Stmt(this._db.prepare(sql));
  }

  transaction(fn) {
    return (...args) => {
      this._db.exec('BEGIN');
      try {
        const result = fn(...args);
        this._db.exec('COMMIT');
        return result;
      } catch (err) {
        this._db.exec('ROLLBACK');
        throw err;
      }
    };
  }
}

function getDb() {
  if (_db) return _db;

  const isNew = !fs.existsSync(DB_PATH);
  _db = new DB(DB_PATH);

  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('synchronous = NORMAL');

  if (isNew) {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    _db.exec(schema);
    console.log('✅  Database initialised from schema.sql');
  }

  return _db;
}

module.exports = { getDb };
