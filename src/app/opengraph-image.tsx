import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

// 링크를 카카오톡·인스타그램 등에 공유할 때 보이는 대표 이미지(1200×630). 모든 화면에 붙는다.
// 글자는 로고 그림(CASTING FLOW)만 써서 한글 글꼴 없이 만든다. 제목·설명은 각 화면의 title·description이 쓰인다.
// 바탕색은 앱 아이콘(public/icon-512.png)의 바탕색과 같아서 아이콘 테두리가 드러나지 않는다.
export const alt = '캐스팅플로우 — 공고부터 합격까지, 한곳에서 캐스팅';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const png = async (path: string) =>
  `data:image/png;base64,${(await readFile(join(process.cwd(), 'public', path))).toString('base64')}`;

const [icon, wordmark] = await Promise.all([png('icon-512.png'), png('brand/wordmark.png')]);

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
        background: '#e6ebf5',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon} width={440} height={440} alt="" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={wordmark} width={560} height={187} alt="" />
        <div style={{ width: 150, height: 14, borderRadius: 7, background: '#c5ff45' }} />
      </div>
    </div>,
    size,
  );
}
