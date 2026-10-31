// 데모용 배우 프로필 사진(public/actors). 번호는 아래 순서와 같다.
// 1 여·숏컷  2 남·소년미  3 여·중년  4 여·곱슬  5 남·중년
// 6 남·버즈컷  7 여·긴 머리  8 여·숏컷  9 남·장발
// 10 여·단발  11 남·청년  12 남·백발 장년  13 여·붉은 숏컷
// 14 여·긴 생머리  15 남·곱슬 중년  16 남·청년 앞머리
export function demoFace(n: number) {
  return `/actors/actor-${String(n).padStart(2, '0')}.jpg`;
}
