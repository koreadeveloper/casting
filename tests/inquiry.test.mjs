import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInquiry } from '../src/lib/inquiry.ts';

const ok = {
  kind: 'report',
  email: ' Actor@Example.com ',
  body: '공고에 없던 노출 장면을 요구받았어요.',
  link: '/apply/demo-indie-lead',
  agree: true,
};

test('문의: 정상 입력은 정리해서 돌려준다', () => {
  assert.deepEqual(parseInquiry(ok), {
    kind: 'report',
    email: 'actor@example.com',
    body: '공고에 없던 노출 장면을 요구받았어요.',
    link: '/apply/demo-indie-lead',
  });
});

test('문의: 종류·이메일·내용 길이·동의를 각각 확인한다', () => {
  assert.ok('error' in parseInquiry({ ...ok, kind: 'spam' }));
  assert.ok('error' in parseInquiry({ ...ok, kind: 'toString' }));
  assert.ok('error' in parseInquiry({ ...ok, email: 'not-an-email' }));
  assert.ok('error' in parseInquiry({ ...ok, body: '짧아요' }));
  assert.ok('error' in parseInquiry({ ...ok, agree: 'on' }));
});

test('문의: 링크는 앱 안 주소나 http(s)만 받는다', () => {
  assert.equal(parseInquiry({ ...ok, link: '' }).link, '');
  assert.equal(
    parseInquiry({ ...ok, link: 'https://example.com/x' }).link,
    'https://example.com/x',
  );
  assert.ok('error' in parseInquiry({ ...ok, link: 'javascript:alert(1)' }));
});
