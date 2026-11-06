-- 파일럿 전에 운영 DB의 테스트 공고를 정리하는 스크립트.
-- Supabase 대시보드 → SQL Editor에서 '1단계'부터 한 칸씩 실행한다.
-- 지우지 않고 '보관(archived_at)·마감' 처리만 해서, 잘못 골랐으면 3단계로 되돌릴 수 있다.
-- 테스트 계정은 SQL로 지우지 말고, 그 계정으로 로그인해 '회원 탈퇴'로 지운다(올린 사진까지 함께 지워진다).

-- ── 1단계: 대상 확인 (아무것도 바꾸지 않음) ─────────────────────────────
-- 제목에 '테스트'·'test'·'샘플'이 들어간 프로젝트와 만든 사람, 지원서 수.
SELECT p.id, p.title, u.email AS owner_email, p.created_at, p.archived_at,
       (SELECT COUNT(*) FROM roles r WHERE r.project_id = p.id) AS roles,
       (SELECT COUNT(*) FROM applications a JOIN roles r ON r.id = a.role_id
         WHERE r.project_id = p.id) AS applications
FROM projects p LEFT JOIN users u ON u.id = p.owner_id
WHERE p.title ILIKE '%테스트%' OR p.title ILIKE '%test%' OR p.title ILIKE '%샘플%'
ORDER BY p.created_at;

-- 위 목록에 안 걸린 것도 있을 수 있으니 전체 프로젝트도 한 번 훑어본다.
SELECT p.id, p.title, u.email AS owner_email, p.created_at, p.archived_at
FROM projects p LEFT JOIN users u ON u.id = p.owner_id
ORDER BY p.created_at;

-- 계정 목록(테스트 계정을 골라 '회원 탈퇴'할 때 참고)
SELECT id, email, name, role, created_at FROM users ORDER BY created_at;

-- ── 2단계: 보관·마감 처리 ──────────────────────────────────────────────
-- 1단계 결과를 보고, 정리할 프로젝트 id를 아래 목록에 직접 넣어서 실행한다.
-- (제목 조건으로 한 번에 바꾸지 않는 것은, 진짜 공고가 잘못 걸리는 일을 막기 위해서다)
BEGIN;
UPDATE projects SET archived_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE id IN ('여기에-프로젝트-id', '여기에-프로젝트-id-2') AND archived_at IS NULL;
UPDATE roles SET is_closed = 1
WHERE project_id IN ('여기에-프로젝트-id', '여기에-프로젝트-id-2');
-- 결과 확인 뒤 문제가 없으면 COMMIT, 이상하면 ROLLBACK
COMMIT;

-- ── 3단계(필요할 때만): 되돌리기 ───────────────────────────────────────
-- UPDATE projects SET archived_at = NULL WHERE id IN ('여기에-프로젝트-id');
-- UPDATE roles SET is_closed = 0 WHERE project_id IN ('여기에-프로젝트-id');
