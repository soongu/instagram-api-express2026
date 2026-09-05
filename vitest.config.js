import { defineConfig } from 'vitest/config';

// 내부 검증 전용 설정 — 학생에게 노출하지 않는다.
// 🚨 파일 병렬을 끈다. 이 저장소의 테스트는 «진짜 포트 3000 에 서버를 띄워서»
//    재기 때문에, 파일 둘이 동시에 돌면 뒤엣것이 EADDRINUSE 로 죽는다.
//    그 죽음은 코드 결함이 아니라 실행 조건이라 판정이 거짓이 된다.
export default defineConfig({
  test: {
    fileParallelism: false,
    include: ['test/**/*.test.js'],
  },
});
