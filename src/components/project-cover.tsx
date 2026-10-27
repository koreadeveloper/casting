// 작품 포스터. 제작자가 올린 포스터가 있으면 그것을, 없으면 작품명으로 만든 기본 커버를 그린다.
// (예전에는 작품과 상관없는 임의 사진을 넣었는데, 실제 작품 이미지로 오해할 수 있어 바꿨다)
// 훅이 없어서 서버·클라이언트 화면 어디서나 쓸 수 있다. 부모 칸을 꽉 채운다.

const THEMES = 4;

/** 같은 작품은 늘 같은 색이 나오도록 작품명으로 색을 고른다. */
function themeOf(title: string) {
  let sum = 0;
  for (const char of title) sum = (sum * 31 + char.charCodeAt(0)) % 9973;
  return sum % THEMES;
}

export default function ProjectCover({
  title,
  posterUrl,
  className = '',
}: {
  title: string;
  posterUrl?: string;
  className?: string;
}) {
  if (posterUrl)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={`pcover-img ${className}`} src={posterUrl} alt="" loading="lazy" />
    );
  return (
    <div className={`pcover pcover-t${themeOf(title)} ${className}`} aria-hidden>
      <svg className="pcover-mark" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.2 5.6 4.9 3.4l.5-1.8a1 1 0 0 1 1.2-.7l14.6 2.2a1 1 0 0 1 .8 1.2l-.4 1.6a1 1 0 0 1-1.4.3Zm.3 2.9H3.5A1.5 1.5 0 0 0 2 10v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-9a1.5 1.5 0 0 0-1.5-1.5Z" />
      </svg>
      <span className="pcover-title">{title}</span>
    </div>
  );
}
