import type { NextRequest } from 'next/server';
import { getProducerId } from './auth';
import { applicationOwnedBy, getApplication } from './db';

/**
 * 이 지원서의 대화에 누가 들어왔는지 정한다. (api/chat/[id]/route.ts의 authorize와 같은 규칙)
 * - 배우: 로그인 없이 지원 현황 주소의 토큰으로 들어온다. 제작진이 대화를 연 뒤에만.
 * - 제작자: 로그인한 공고 주인.
 * 사진·링크처럼 머리글을 붙일 수 없는 요청을 위해 토큰은 주소의 ?t= 로도 받는다.
 */
export async function chatParticipant(
  request: NextRequest,
  applicationId: string,
  receipt?: string,
): Promise<'producer' | 'actor' | null> {
  const token =
    receipt ||
    request.headers.get('x-receipt-token') ||
    request.nextUrl.searchParams.get('t') ||
    '';
  if (token) {
    const application = await getApplication(applicationId);
    return application?.chatOpen && token.length >= 40 && token === application.receiptToken
      ? 'actor'
      : null;
  }
  const producerId = await getProducerId();
  if (producerId && (await applicationOwnedBy(applicationId, producerId))) return 'producer';
  return null;
}
