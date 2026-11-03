# instagram-api

인스타그램 클론의 백엔드 서버예요. Express 5 + PostgreSQL + Prisma로 만들어져 있고, 게시물을 올리고 보고 고치고 지우고 좋아요를 누르는 API가 들어 있어요.

이 문서는 처음 내려받은 사람이 서버를 띄워서 `http://localhost:3000/api/posts`에 게시물이 나오는 데까지를 안내해요. 위에서부터 순서대로 따라 하세요.

## 0. 준비물

아래 셋이 설치되어 있어야 해요.

| 도구 | 확인 방법 | 기준 |
|---|---|---|
| Node.js | 터미널에서 `node -v` | v24 이상 |
| Docker Desktop | 터미널에서 `docker -v`, 그리고 Docker Desktop 앱이 **실행 중**인지 | 아무 버전 |
| Git | 터미널에서 `git --version` | 아무 버전 |

Docker는 PostgreSQL을 내 컴퓨터에 설치하는 대신, 컨테이너로 한 줄에 띄우려고 써요. 앱을 켜두지 않으면 아래 3단계에서 막혀요.

## 1. 내려받고 패키지 설치

```bash
git clone <저장소 주소>
cd <내려받은 폴더>
npm install
```

## 2. `.env` 파일 만들기

서버는 접속할 DB 주소 같은 설정을 `.env` 파일에서 읽어요. 이 파일은 사람마다 값이 다를 수 있어서 저장소에 올라가 있지 않아요. 직접 만들어야 해요.

프로젝트 맨 위 폴더(`package.json`이 있는 곳)에 `.env`라는 이름의 파일을 새로 만들고, 아래 내용을 그대로 붙여넣으세요.

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/instagram"
CORS_ORIGIN=http://localhost:5173
PORT=3000
```

각 줄의 뜻은 이래요.

| 이름 | 뜻 |
|---|---|
| `DATABASE_URL` | 서버가 접속할 PostgreSQL 주소예요. 3단계에서 띄울 DB의 설정(사용자 `postgres`, 비밀번호 `postgres`, 포트 `5432`, DB 이름 `instagram`)과 같아야 해요. |
| `CORS_ORIGIN` | 이 서버로 요청을 보내도 되는 프론트엔드 주소예요. 로컬에서 React(Vite)를 띄우면 `http://localhost:5173`이에요. 주소가 여러 개면 쉼표로 이어 적어요. 예: `http://localhost:5173,http://localhost:3001` |
| `PORT` | 서버가 열릴 포트 번호예요. 따로 안 적으면 3000번을 써요. |

⚠️ `.env`에 값이 빠졌거나 파일이 없으면 서버가 시작하자마자 에러로 멈춰요. 파일 이름이 `.env.txt`처럼 저장되지 않았는지 확인하세요.

## 3. 데이터베이스 띄우기

```bash
docker compose up -d
```

처음에는 PostgreSQL 이미지를 내려받느라 1~2분쯤 걸려요. 끝나면 확인해요.

```bash
docker compose ps
```

`instagram-db`가 `running`(또는 `Up`)으로 보이면 돼요. 방금 띄웠다면 DB가 준비되는 데 몇 초 더 걸리니, 다음 단계는 10초쯤 기다렸다가 하세요.

## 4. 테이블 만들기

지금 DB는 텅 비어 있어요. 이 프로젝트가 쓰는 테이블을 만들어요.

```bash
npm run build
```

이 명령은 두 가지를 차례로 해요.

1. `prisma generate` — 코드에서 DB를 다루는 Prisma 클라이언트를 만들어요.
2. `prisma migrate deploy` — `prisma/migrations` 폴더의 기록을 순서대로 실행해서 테이블을 만들어요.

마지막에 `All migrations have been successfully applied.`가 나오면 성공이에요.

## 5. 예시 데이터 넣기

```bash
npm run seed
```

`사람 5명, 게시물 5개, 사진 8장, 댓글 9개, 답글 3개를 넣었어요.`라고 나오면 돼요.

⚠️ 이 명령은 테이블을 **전부 비우고** 예시 데이터로 다시 채워요. 직접 올린 게시물이 있다면 사라지니, 데이터를 초기 상태로 되돌리고 싶을 때만 다시 실행하세요.

## 6. 서버 실행

```bash
npm run dev
```

터미널에 이 문장이 나오면 서버가 켜진 거예요.

```
서버가 3000번 포트에서 기다리고 있어요.
```

`npm run dev`는 코드를 저장할 때마다 서버를 자동으로 다시 시작해요. 끄려면 터미널에서 `Ctrl + C`를 누르세요.

⚠️ 서버는 `npm run dev`로 켜세요. `npm start`는 `.env`를 읽지 않는 명령이라, `CORS_ORIGIN`을 못 찾고 에러가 나요.

## 7. 잘 되는지 확인

브라우저 주소창에 아래 주소를 열어 보세요.

| 주소 | 보이는 것 |
|---|---|
| `http://localhost:3000` | `인스타그램 서버가 살아 있어요` |
| `http://localhost:3000/api/posts` | 게시물 목록(JSON) |
| `http://localhost:3000/api/posts/1` | 1번 게시물 하나 |

게시물 목록이 보이면 끝이에요. `requests/` 폴더의 `.http` 파일에는 게시물 올리기·고치기·지우기·좋아요 같은 요청 예시가 들어 있어요. VS Code에서 httpYac 확장을 설치하면 파일 안의 `Send Request`를 눌러 바로 보내 볼 수 있어요.

## 자주 만나는 문제

| 증상 | 원인과 해결 |
|---|---|
| `npm run build`에서 `Can't reach database server at localhost:5432` (`P1001`) | DB가 안 떠 있어요. Docker Desktop 앱이 켜져 있는지 보고 `docker compose up -d`를 하세요. 방금 띄웠다면 10초 뒤에 다시 해보세요. |
| `docker compose up -d`에서 `port is already allocated` | 내 컴퓨터의 5432번 포트를 다른 PostgreSQL이 쓰고 있어요. 그 프로그램을 끄거나, 이미 다른 프로젝트의 DB 컨테이너가 떠 있으면 `docker ps`로 찾아서 `docker stop <이름>`으로 끄세요. |
| 서버는 켜졌는데 `/api/posts`가 `서버에서 문제가 생겼어요`(500) | 테이블이 없거나 비어 있는 경우가 많아요. 4단계(`npm run build`)와 5단계(`npm run seed`)를 했는지 확인하세요. |
| 서버를 켜자마자 `Cannot read properties of undefined (reading 'split')` | `.env`가 없거나 `CORS_ORIGIN` 줄이 빠졌어요. 2단계를 다시 확인하고, `npm start`가 아니라 `npm run dev`로 켜세요. |
| `Cannot read properties of undefined (reading 'createMany')` 처럼 `prisma.○○`가 `undefined` | Prisma 클라이언트가 최신이 아니에요. `npx prisma generate`를 하세요. |
| `npm run build`에서 `P3015`, `Could not find the migration file` | `prisma/migrations` 안에 `migration.sql`이 없는 빈 폴더가 있어요. 그 빈 폴더를 지우고 다시 하세요. |
| `서버가 3000번 포트에서 기다리고 있어요.`가 찍히고는 바로 터미널 입력 줄로 돌아와요 | 3000번 포트를 다른 프로그램이 쓰고 있어서 서버가 실제로는 안 켜진 거예요. `.env`의 `PORT`를 `4000`처럼 다른 번호로 바꾸고 다시 `npm run dev`를 하세요. 프론트엔드가 호출하는 주소도 같은 번호로 맞춰야 해요. |
| DB를 완전히 처음부터 다시 하고 싶어요 | `docker compose down -v`로 DB와 데이터를 지우고, 3·4·5단계를 다시 하세요. (`-v` 없이 `docker compose down`만 하면 데이터는 남아요.) |

## 스택

| | |
|---|---|
| 런타임 | Node.js 24 이상 (ESM — `"type": "module"`) |
| 프레임워크 | Express 5 |
| DB | PostgreSQL 18 (Docker) + Prisma 7 |

## 폴더

```
 app.js            서버의 시작 파일
 routes/           주소별 처리 (게시물 등)
 services/         DB를 다루는 코드
 prisma/           테이블 정의(schema.prisma)와 마이그레이션 기록
 seed.js           예시 데이터 넣기
 requests/         .http 요청 예시
 compose.yaml      PostgreSQL 컨테이너 설정
 lab/              실습·과제 파일
```
