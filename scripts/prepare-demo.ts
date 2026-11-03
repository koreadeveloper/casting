// Vercel 체험 배포용: 빌드 시 Supabase 데이터베이스에 스키마와 가상 계정·배역·지원자를 채운다.
// 시드는 중복 삽입을 막도록 작성되어 있어 여러 번 실행해도 안전하다.

export {};

if (process.env.DEMO_MODE === 'true') {
  process.env.DEMO_BUILD = 'true';
  process.env.SEED_DEMO = 'true';
  const { db, ensureReady } = await import('../src/lib/db');
  const { closePool } = await import('../src/lib/sql');
  await ensureReady();
  const result = await db().prepare('SELECT COUNT(*) AS count FROM users').get();
  await closePool();
  console.log('Prepared sample database:', result);
}
