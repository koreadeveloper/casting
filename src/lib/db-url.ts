/**
 * Supabase Session 풀러(포트 5432)는 무료 요금제에서 동시 연결이 15개뿐이라, 서버리스 인스턴스 몇 개가
 * 연결을 잡고 있으면 새 요청이 연결을 못 얻어 화면이 서버 오류로 뜬다.
 * 같은 풀러의 Transaction 모드(포트 6543)로 바꿔 쓴다. 이 앱은 세션 상태(SET, 세션 잠금, 이름 붙은
 * prepared statement)를 쓰지 않고 잠금도 트랜잭션 잠금(withAdvisoryLock)이라 그대로 동작한다.
 * DB_SESSION_POOLER=true면 바꾸지 않는다.
 */
export function transactionPoolerUrl(url: string, env: Record<string, string | undefined> = {}) {
  if (env.DB_SESSION_POOLER === 'true') return url;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('.pooler.supabase.com') || parsed.port !== '5432') return url;
    parsed.port = '6543';
    return parsed.toString();
  } catch {
    return url;
  }
}
