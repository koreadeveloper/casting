// Postgres(Supabase) 접근 계층.
//
// 예전 node:sqlite 코드의 `prepare(sql).get/all/run(...)` 모양을 그대로 비동기로 옮겨,
// 쿼리 본문(`?` 자리표시자, INSERT OR IGNORE)은 거의 손대지 않고 쓸 수 있게 한다.
// 트랜잭션 안의 쿼리는 AsyncLocalStorage로 같은 연결에 묶인다.

import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, types, type PoolClient } from 'pg';

// COUNT/SUM은 기본적으로 문자열로 오므로 숫자로 받는다. (SQLite와 같은 동작)
types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

export type Row = Record<string, unknown>;
export type RunResult = { changes: number };

const transactionClient = new AsyncLocalStorage<PoolClient>();
let pool: Pool | undefined;

function connectionString() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL이 설정되어 있지 않습니다. .env.local을 확인하세요.');
  return url;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString(),
      // 서버리스 함수 하나가 연결을 많이 잡지 않도록 작게 유지한다.
      max: Number(process.env.DB_POOL_MAX || 5),
      idleTimeoutMillis: 10_000,
    });
  }
  return pool;
}

/** SQLite 방언을 Postgres로 바꾼다: `?` → `$n`, `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`. */
export function toPostgres(sql: string) {
  let ignore = false;
  let text = sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, () => {
    ignore = true;
    return 'INSERT INTO';
  });
  let out = '';
  let index = 0;
  let quote = '';
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = '';
      out += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      out += char;
    } else if (char === '?') {
      out += `$${++index}`;
    } else {
      out += char;
    }
  }
  text = out.trimEnd().replace(/;$/, '');
  return ignore ? `${text} ON CONFLICT DO NOTHING` : text;
}

function executor() {
  return transactionClient.getStore() ?? getPool();
}

async function query(sql: string, params: unknown[]) {
  return executor().query(toPostgres(sql), params as unknown[]);
}

export class Statement {
  constructor(private readonly sql: string) {}

  async get(...params: unknown[]): Promise<Row | undefined> {
    const result = await query(this.sql, params);
    return result.rows[0] as Row | undefined;
  }

  async all(...params: unknown[]): Promise<Row[]> {
    const result = await query(this.sql, params);
    return result.rows as Row[];
  }

  async run(...params: unknown[]): Promise<RunResult> {
    const result = await query(this.sql, params);
    return { changes: result.rowCount ?? 0 };
  }
}

export type Conn = {
  prepare(sql: string): Statement;
  /** 자리표시자 없는 여러 문장을 한 번에 실행한다. (스키마·트랜잭션 제어용) */
  exec(sql: string): Promise<void>;
};

export const conn: Conn = {
  prepare: (sql) => new Statement(sql),
  exec: async (sql) => {
    await executor().query(sql);
  },
};

/** 콜백 안의 모든 쿼리를 하나의 트랜잭션으로 묶는다. 던지면 롤백한다. */
export async function transaction<T>(work: () => Promise<T>): Promise<T> {
  if (transactionClient.getStore()) return work(); // 이미 트랜잭션 안이면 그대로 합친다.
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const value = await transactionClient.run(client, work);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 동시에 뜨는 서버리스 인스턴스끼리 스키마 변경이 겹치지 않도록 잠금을 잡고 실행한다.
 * Supabase 풀러(Supavisor)는 세션 잠금을 지원하지 않으므로 트랜잭션 잠금을 쓴다.
 */
export async function withAdvisoryLock<T>(key: number, work: () => Promise<T>): Promise<T> {
  return transaction(async () => {
    await executor().query('SELECT pg_advisory_xact_lock($1)', [key]);
    return work();
  });
}

export async function closePool() {
  await pool?.end();
  pool = undefined;
}
