import initSqlJs from 'sql.js'
import type { Database, BindParams } from 'sql.js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { createTables } from './schema'

export let db: Database
let dbFilePath: string

export async function initDb(): Promise<void> {
  dbFilePath = join(app.getPath('userData'), 'whatsinvo.db')
  const SQL = await initSqlJs()

  if (existsSync(dbFilePath)) {
    db = new SQL.Database(readFileSync(dbFilePath))
  } else {
    db = new SQL.Database()
  }

  db.run('PRAGMA foreign_keys = ON')
  createTables(db)
  persist()
}

export function persist(): void {
  writeFileSync(dbFilePath, Buffer.from(db.export()))
}

export function queryAll<T extends object>(sql: string, params: BindParams = []): T[] {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return rows
}

export function queryOne<T extends object>(sql: string, params: BindParams = []): T | undefined {
  return queryAll<T>(sql, params)[0]
}

export function run(sql: string, params: BindParams = []): number {
  db.run(sql, params)
  const result = db.exec('SELECT last_insert_rowid() as id')
  return (result[0]?.values[0][0] as number) ?? 0
}
