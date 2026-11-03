'use client';

import { useEffect, useRef } from 'react';

/** 약관 문서를 가입 화면을 벗어나지 않고 띄워 본다. 문서는 /terms, /privacy를 embed 모드로 불러온다. */
export default function LegalModal({
  title,
  src,
  onClose,
}: {
  title: string;
  src: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="legal-modal"
      aria-label={title}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && ref.current?.close()}
    >
      <div className="legal-modal-head">
        <strong>{title}</strong>
        <button
          type="button"
          className="button button-outline sm"
          onClick={() => ref.current?.close()}
        >
          닫기
        </button>
      </div>
      <iframe title={title} src={`${src}?embed=1`} />
    </dialog>
  );
}
