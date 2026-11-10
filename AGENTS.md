<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git·PR 규칙

- PR을 main에 합칠 때는 **Squash and merge**로 합친다. PR 하나가 main에 커밋 한 줄(`제목 (#번호)`)로 남게 한다. Merge commit·Rebase 방식은 쓰지 않는다.
- main에 직접 푸시하지 않는다. 작업 브랜치 → PR → Vercel 미리보기 확인 → 합치기(배포) 순서로 진행한다.
