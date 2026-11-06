// 출연 제안 알림 메일 내용. DB·Next에 기대지 않아 테스트로 지킨다.

type ProposalForMail = {
  actorName: string;
  producerName: string;
  orgName: string;
  projectTitle: string;
  roleTitle: string;
  message: string;
};

export function proposalMail(proposal: ProposalForMail, origin: string) {
  const from = [proposal.orgName, proposal.producerName].filter(Boolean).join(' ') || '제작진';
  return {
    subject: `[캐스팅플로우] ${proposal.projectTitle} '${proposal.roleTitle}' 출연 제안이 왔어요`,
    text: [
      `${proposal.actorName}님, 안녕하세요.`,
      '',
      `${from}에서 출연 제안을 보냈어요.`,
      `작품: ${proposal.projectTitle}`,
      `배역: ${proposal.roleTitle}`,
      '',
      '― 제작진 메시지 ―',
      proposal.message,
      '',
      '제안을 확인하고 수락하려면 아래 주소에서 로그인해 주세요. 수락하면 지원서를 내는 화면으로 이어져요.',
      `${origin}/me`,
      '',
      '이 메일은 캐스팅플로우에서 받은 출연 제안을 알려 드리려고 보냈어요.',
    ].join('\n'),
  };
}
