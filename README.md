# instagram-api

파트2 `4-node-backend`(`p2-22`~`p2-25`)·`5-db-prisma`(`p2-26`~)에서 만들어 가는
인스타그램 클론 백엔드입니다. 회차마다 한 겹씩 쌓습니다.

계약(엔드포인트·응답 형식)의 정전은 참조 저장소의 `docs/api_documentation.md`입니다.
DB 는 2단으로 갑니다 — `4-node-backend` 가 MongoDB/Mongoose 로 짓고,
`5-db-prisma` 가 **같은 API 를** PostgreSQL + Prisma 로 다시 짓습니다.

## 스택

| | |
|---|---|
| 런타임 | Node.js 24 LTS (ESM — `"type": "module"`) |
| 프레임워크 | Express 5 |
| DB ① | MongoDB Atlas + Mongoose (`p2-24`~) |
| DB ② | PostgreSQL + Prisma (`p2-26`~) |
| 내부 검증 | Vitest + supertest — **학생에게 노출하지 않는다** |

## 실행

```bash
npm install
npm run dev      # node --watch app.js
npm test         # 내부 검증 전용
```

## 폴더

```
 app.js            수업에서 계속 키워 나가는 척추 파일
 lab/p2-NN/        회차별 실습·과제 (학생 쪽에서는 lab/ 하나)
 test/             내부 검증 전용 — 교안에 한 줄도 인용하지 않는다
```

학생 쪽 경로는 `~/instagram-api/app.js` · `~/instagram-api/lab/practice1.js` 입니다.
코드베이스가 회차별 디렉토리(`lab/p2-22/`)로 나누는 것은 파일명 충돌 때문이고,
**파일 첫 줄 경로 주석은 교안 표기를 그대로 둡니다.**

## 회차 브랜치

회차가 끝나면 `code/p2-NN` 브랜치를 심습니다. 그 회차까지 배운 코드 전량을
브랜치 스위칭 한 번으로 볼 수 있어야 합니다.
