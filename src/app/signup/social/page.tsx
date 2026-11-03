import { redirect } from 'next/navigation';

// 예전 소셜 가입 마무리 주소. 이제는 역할 화면에서 바로 가입을 마친다.
export default function SocialSignupPage() {
  redirect('/signup');
}
