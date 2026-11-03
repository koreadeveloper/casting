// AI 호출에 쓰는 클라이언트. 서버에서만 쓴다.
// 키와 주소는 Anthropic SDK의 기본 환경변수(ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL)를 그대로 따른다.
// MonoRouter 같은 중계 서비스를 쓰려면 ANTHROPIC_BASE_URL만 그쪽 주소로 바꾸면 된다.

import Anthropic from '@anthropic-ai/sdk';

/** ANTHROPIC_API_KEY가 없으면 AI 기능을 열지 않는다(화면에서 '준비 중'으로 안내). */
export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | undefined;
export function anthropic() {
  client ??= new Anthropic();
  return client;
}
