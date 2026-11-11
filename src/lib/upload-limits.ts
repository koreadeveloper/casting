// 업로드 크기 한도. 화면과 서버가 같이 쓰는 리프 모듈이다(다른 lib를 가져오지 않는다).
//
// - 서버(Vercel 함수)를 거치는 업로드는 요청 크기 제한(4.5MB)에 걸려 4MB까지만 받는다(사진·대화 첨부·인증 서류).
// - 프로필 PDF(자료실·자동 채우기)는 브라우저가 Supabase 저장소로 바로 올려서 20MB까지 받는다.
//   20MB는 사진이 여러 장 든 프로필 PDF(보통 5~15MB)를 넉넉히 담고, AI가 PDF를 읽을 수 있는
//   요청 한도(32MB, 파일을 글자로 바꾸면 1.33배가 된다)보다 작다.

export const SERVER_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
export const PROFILE_PDF_MAX_BYTES = 20 * 1024 * 1024;
export const PROFILE_PDF_MAX_LABEL = '20MB';

export function isPdfFile(file: { name: string; type: string }) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function formatMegabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** 프로필 PDF가 너무 크면 안내 문구, 괜찮으면 ''. */
export function profilePdfTooLarge(size: number) {
  return size > PROFILE_PDF_MAX_BYTES
    ? `PDF는 ${PROFILE_PDF_MAX_LABEL}까지 올릴 수 있어요(고른 파일 ${formatMegabytes(size)}). 사진 해상도를 낮추거나 PDF 압축 후 다시 올려 주세요.`
    : '';
}

/** 저장소에 바로 올린 파일 이름: 자료실은 'UUID.pdf', 자동 채우기용 임시 파일은 'tmp/UUID.pdf'. */
export function isStoredPdfName(name: string) {
  return /^[a-f0-9-]{36}\.pdf$/.test(name);
}
