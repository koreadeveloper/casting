'use client';

import { useState } from 'react';
import PhotoLightbox from '@/components/photo-lightbox';
import { formatFileSize, isImageExt, opensInline } from '@/lib/chat-files';
import type { ChatAttachment } from '@/lib/types';

/** 대화 첨부 파일 주소. 배우는 로그인 없이 지원 현황 토큰으로 연다. */
export function chatFileUrl(
  applicationId: string,
  key: string,
  receipt?: string,
  download = false,
) {
  const params = new URLSearchParams();
  if (receipt) params.set('t', receipt);
  if (download) params.set('download', '1');
  const query = params.toString();
  return `/api/chat/${applicationId}/files/${key}${query ? `?${query}` : ''}`;
}

const KIND_LABEL: Record<string, string> = {
  pdf: 'PDF',
  hwp: '한글',
  hwpx: '한글',
  doc: '워드',
  docx: '워드',
  xls: '엑셀',
  xlsx: '엑셀',
  ppt: 'PPT',
  pptx: 'PPT',
};

export function FileBadge({ ext }: { ext: string }) {
  return <span className={`file-badge file-${ext}`}>{KIND_LABEL[ext] || ext.toUpperCase()}</span>;
}

export default function ChatAttachmentView({
  applicationId,
  attachment,
  receipt,
}: {
  applicationId: string;
  attachment: ChatAttachment;
  receipt?: string;
}) {
  const [viewing, setViewing] = useState(false);
  const [broken, setBroken] = useState(false);
  const url = chatFileUrl(applicationId, attachment.key, receipt);
  const downloadUrl = chatFileUrl(applicationId, attachment.key, receipt, true);

  if (isImageExt(attachment.ext) && !broken) {
    return (
      <>
        <button
          type="button"
          className="chat-photo"
          onClick={() => setViewing(true)}
          aria-label={`사진 크게 보기: ${attachment.name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={attachment.name} loading="lazy" onError={() => setBroken(true)} />
        </button>
        {viewing && (
          <PhotoLightbox photos={[url]} name={attachment.name} onClose={() => setViewing(false)} />
        )}
      </>
    );
  }

  return (
    <div className="chat-file">
      <FileBadge ext={attachment.ext} />
      <div className="chat-file-info">
        <strong title={attachment.name}>{attachment.name}</strong>
        <span>{formatFileSize(attachment.size)}</span>
      </div>
      <div className="chat-file-actions">
        {opensInline(attachment.ext) && (
          <a href={url} target="_blank" rel="noopener noreferrer">
            열기
          </a>
        )}
        <a href={downloadUrl} download={attachment.name}>
          저장
        </a>
      </div>
    </div>
  );
}
