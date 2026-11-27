# instagram-api

인스타그램 클론의 백엔드 서버예요. Express 5 + PostgreSQL + Prisma로 만들어져 있고, 게시물·댓글·좋아요·사진 올리기·해시태그·프로필·팔로우·DM(메시지)·알림과 로그인(비밀번호·소셜 로그인)을 하는 API가 들어 있어요. DM과 알림은 Socket.IO로 실시간으로도 보내요.

짝이 되는 화면(프론트엔드)은 [codeit-fs-16-next](https://github.com/soongu/codeit-fs-16-next)예요. 화면까지 같이 띄우려면 이 서버를 먼저 켜고, 그 저장소의 README를 이어서 따라 하세요.

이 문서는 처음 내려받은 사람이 서버를 띄워서 로그인과 게시물 목록 요청이 되는 데까지를 안내해요. 위에서부터 순서대로 따라 하세요.

## 0. 준비물

아래 셋이 설치되어 있어야 해요.

| 도구 | 확인 방법 | 기준 |
|---|---|---|
| Node.js | 터미널에서 `node -v` | v24 이상 |
| Docker Desktop | 터미널에서 `docker -v`, 그리고 Docker Desktop 앱이 **실행 중**인지 | 아무 버전 |
| Git | 터미널에서 `git --version` | 아무 버전 |

Docker는 PostgreSQL을 내 컴퓨터에 설치하는 대신, 컨테이너로 한 줄에 띄우려고 써요. 앱을 켜 두지 않으면 아래 3단계에서 막혀요.

## 1. 내려받고 패키지 설치

```bash
git clone https://github.com/soongu/instagram-api-express2026.git
cd instagram-api-express2026
npm install
```

`main` 브랜치에는 **마지막으로 정리된 코드(p3-70 시점)** 가 들어 있어요. 이 README 대로 하면 바로 돌아가요.

수업 회차별 코드를 보고 싶으면 아래 「회차별 브랜치 보기」를 읽으세요.

## 2. `.env` 파일 만들기

서버는 접속할 DB 주소 같은 설정을 `.env` 파일에서 읽어요. 이 파일은 사람마다 값이 달라서 저장소에 올라가 있지 않아요. 예시 파일을 복사해서 만들어요.

```bash
# macOS / Linux / Git Bash
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

복사한 `.env`는 따로 고칠 필요 없이 그대로 써도 돼요. 내용은 이래요.

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/instagram"
CORS_ORIGIN=http://localhost:3001
PORT=3000
JWT_SECRET=dev-only-secret-change-me
SITE_URL=http://localhost:3001
GOOGLE_CLIENT_ID=dummy
GOOGLE_CLIENT_SECRET=dummy
KAKAO_CLIENT_ID=dummy
KAKAO_CLIENT_SECRET=dummy
NAVER_CLIENT_ID=dummy
NAVER_CLIENT_SECRET=dummy
ACCESS_TOKEN_SECONDS=
```

각 줄의 뜻은 이래요.

| 이름 | 뜻 |
|---|---|
| `DATABASE_URL` | 서버가 접속할 PostgreSQL 주소예요. 3단계에서 띄울 DB의 설정(사용자 `postgres`, 비밀번호 `postgres`, 포트 `5432`, DB 이름 `instagram`)과 같아야 해요. |
| `CORS_ORIGIN` | 이 서버로 요청을 보내도 되는 프론트엔드 주소예요. 짝 저장소(Next.js)를 3001번 포트로 띄우면 `http://localhost:3001`이에요. 주소가 여러 개면 쉼표로 이어 적어요. 예: `http://localhost:3001,http://localhost:5173` |
| `PORT` | 서버가 열릴 포트 번호예요. 따로 안 적으면 3000번을 써요. |
| `JWT_SECRET` | 로그인 토큰에 서명하는 비밀 문자열이에요. 연습용 값이라 아무 문자열이나 써도 돼요. 실제 서비스에서는 길고 무작위인 값을 쓰고 절대 저장소에 올리지 않아요. |
| `SITE_URL` | 화면(프론트엔드)의 주소예요. 로그인 뒤에 돌아갈 주소와 소셜 로그인의 콜백 주소를 만드는 데 써요. |
| `*_CLIENT_ID`, `*_CLIENT_SECRET` | 구글·카카오·네이버 소셜 로그인 키예요. 값이 **비어 있으면 서버가 켜지지 않아서** 연습용으로 `dummy`가 들어 있어요. |
| `ACCESS_TOKEN_SECONDS` | 로그인 토큰(Access 토큰)의 기한을 초로 적어요. 비워 두면 15분이에요. 기한이 지난 뒤의 동작을 시험해 볼 때만 `60`처럼 짧게 적어요. |

⚠️ 소셜 로그인 버튼까지 실제로 동작시키려면 각 제공자 개발자 사이트에서 직접 앱을 등록해 받은 진짜 키를 `.env`에 넣어야 해요. `dummy`로는 서버만 켜지고 소셜 로그인은 되지 않아요. 비밀번호 로그인(7단계)은 키 없이도 돼요.

⚠️ `.env`에 값이 빠졌거나 파일이 없으면 서버가 시작하자마자 에러로 멈춰요. 파일 이름이 `.env.txt`처럼 저장되지 않았는지 확인하세요. 진짜 키를 넣은 `.env`는 `.gitignore` 덕분에 커밋되지 않지만, 다른 사람에게 보내거나 캡처해서 올리지 마세요.

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

예시 사람들의 로그인 정보는 **사용자 이름 + `1234`** 예요.

| 사용자 이름 | 비밀번호 |
|---|---|
| `jaehoon` | `jaehoon1234` |
| `minji` | `minji1234` |

나머지 세 명도 같은 규칙이에요. 전체 목록은 `data/posts.js` 와 `data/comments.js` 의 `username`을 보세요.

로그인할 때 사용자 이름 자리에 가입할 때 적은 이메일이나 휴대폰 번호를 넣어도 돼요(`@`가 있으면 이메일, 휴대폰 번호 모양이면 휴대폰 번호로 찾아요). 예시 사람들은 이메일과 휴대폰 번호가 없어서 사용자 이름으로 로그인해요.

## 6. 서버 실행

```bash
npm run dev
```

터미널에 이 문장이 나오면 서버가 켜진 거예요.

```
서버가 3000번 포트에서 기다리고 있어요.
```

`npm run dev`는 코드를 저장할 때마다 서버를 자동으로 다시 시작해요. 끄려면 터미널에서 `Ctrl + C`를 누르세요.

⚠️ 서버는 `npm run dev`로 켜세요. `npm start`는 `.env`를 읽지 않는 명령이라 `CORS_ORIGIN`을 못 찾고 에러가 나요.

## 7. 잘 되는지 확인

서버를 켜 둔 터미널은 그대로 두고, **새 터미널**을 열어서 확인해요.

먼저 서버가 살아 있는지 봐요. 브라우저에서 `http://localhost:3000`을 열면 `인스타그램 서버가 살아 있어요`가 보여요.

이 서버의 게시물 API는 **로그인한 사람만** 쓸 수 있어요. 로그인 없이 `http://localhost:3000/api/v2/posts`를 열면 401(로그인이 필요해요) 응답이 오는 게 정상이에요. 터미널에서 로그인하고 게시물을 받아 봐요.

```bash
# 로그인 — 쿠키를 cookies.txt 에 저장해요
curl -c cookies.txt -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"jaehoon","password":"jaehoon1234"}'

# 저장한 쿠키를 들고 게시물 목록 요청
curl -b cookies.txt http://localhost:3000/api/v2/posts
```

로그인 응답에 `"username":"jaehoon"`이 보이고, 게시물 목록에 `노을 진 한강` 같은 게시물이 나오면 성공이에요.

Windows PowerShell에서는 `curl`이 다른 명령이라 이렇게 대신 써요. 줄바꿈 없이 한 줄씩 실행하세요.

```powershell
curl.exe -c cookies.txt -X POST http://localhost:3000/api/v2/auth/login -H "Content-Type: application/json" -d "{\"username\":\"jaehoon\",\"password\":\"jaehoon1234\"}"
curl.exe -b cookies.txt http://localhost:3000/api/v2/posts
```

더 보고 싶다면 이런 것도 있어요.

| 주소 | 보이는 것 |
|---|---|
| `http://localhost:3000/api/docs` | API 문서 화면(Swagger). 브라우저에서 바로 열려요. |
| `http://localhost:3000/dm-test.html` | 화면 없이 DM을 시험해 보는 페이지예요. 로그인한 뒤 대화방 번호를 넣고 메시지를 보내요. 대화방이 아직 없으면 화면 저장소에서 프로필의 «메시지 보내기»로 먼저 만들어요. |
| `requests/` 폴더의 `.http` 파일들 | 로그인·게시물·댓글·사진 올리기·대화방·알림 같은 요청 예시예요. VS Code에서 httpYac 확장을 설치하면 파일 안의 `Send Request`를 눌러 바로 보내 볼 수 있어요. |

## 회차별 브랜치 보기

수업 회차가 끝날 때마다 그 시점의 코드를 브랜치로 남겨 뒀어요. 브랜치 이름이 곧 회차 번호예요(`p3-40`은 파트3의 40번째 회차를 마친 코드). 코드가 바뀌지 않은 회차는 브랜치가 없어서 번호가 건너뛰어 있어요.

```bash
git fetch --all            # 원격 브랜치 목록을 받아와요
git branch -r              # 어떤 회차들이 있는지 봐요
git switch p3-40           # 그 회차 시점의 코드로 바꿔요
```

처음 `git switch p3-40`을 할 때 `invalid reference`가 나오면 `git switch -c p3-40 origin/p3-40`을 쓰세요.

다시 `main`으로 돌아오려면 `git switch main`이에요.

브랜치를 바꾸면 **패키지와 DB 테이블이 그 회차와 달라질 수 있어요.** 바꾼 뒤에는 이 순서로 맞추세요.

```bash
npm install
docker compose down -v     # DB 컨테이너와 데이터를 지워요
docker compose up -d
npm run build
npm run seed
npm run dev
```

⚠️ `p2-22`~`p2-25` 구간은 아직 PostgreSQL이 아니라 MongoDB로 만드는 회차라서 위 3~5단계와 달라요. PostgreSQL + Prisma는 `p2-26`부터예요. 그 회차들은 `main`이 아니라 해당 브랜치의 `.env.example`과 수업 교안을 따르세요.

## 자주 만나는 문제

| 증상 | 원인과 해결 |
|---|---|
| `npm run build`에서 `Can't reach database server at localhost:5432` (`P1001`) | DB가 안 떠 있어요. Docker Desktop 앱이 켜져 있는지 보고 `docker compose up -d`를 하세요. 방금 띄웠다면 10초 뒤에 다시 해보세요. |
| `docker compose up -d`에서 `port is already allocated` | 내 컴퓨터의 5432번 포트를 다른 PostgreSQL이 쓰고 있어요. 그 프로그램을 끄거나, 이미 다른 프로젝트의 DB 컨테이너가 떠 있으면 `docker ps`로 찾아서 `docker stop <이름>`으로 끄세요. |
| 서버를 켜자마자 `OAuth2Strategy requires a clientID option` | `.env`에 `GOOGLE_`·`KAKAO_`·`NAVER_` 의 `CLIENT_ID`·`CLIENT_SECRET` 여섯 줄 중 비어 있거나 빠진 게 있어요. `dummy`라도 값을 채우세요. |
| 서버를 켜자마자 `.env에 JWT_SECRET이 없어요` | `.env`에 `JWT_SECRET` 줄이 없어요. 2단계의 내용과 같은지 확인하세요. |
| 서버를 켜자마자 `Cannot read properties of undefined (reading 'split')` | `.env`가 없거나 `CORS_ORIGIN` 줄이 빠졌어요. 2단계를 다시 확인하고, `npm start`가 아니라 `npm run dev`로 켜세요. |
| `does not provide an export named 'PrismaClient'` 또는 `prisma.○○`가 `undefined` | Prisma 클라이언트가 아직 만들어지지 않았거나 최신이 아니에요. `npm run build`(또는 `npx prisma generate`)를 하세요. |
| 서버는 켜졌는데 게시물 요청이 `서버에서 문제가 생겼어요`(500) | 테이블이 없거나 비어 있는 경우가 많아요. 4단계(`npm run build`)와 5단계(`npm run seed`)를 했는지 확인하세요. |
| 게시물 요청이 401 | 로그인하지 않았어요. 7단계처럼 먼저 로그인하고 쿠키를 같이 보내세요. 비밀번호는 `사용자이름1234`예요. |
| `npm run build`에서 `P3015`, `Could not find the migration file` | `prisma/migrations` 안에 `migration.sql`이 없는 빈 폴더가 있어요. 그 빈 폴더를 지우고 다시 하세요. |
| `서버가 3000번 포트에서 기다리고 있어요.`가 찍히고는 바로 터미널 입력 줄로 돌아와요 | 3000번 포트를 다른 프로그램이 쓰고 있어서 서버가 실제로는 안 켜진 거예요. `.env`의 `PORT`를 `4000`처럼 다른 번호로 바꾸고 다시 `npm run dev`를 하세요. 프론트엔드가 호출하는 주소(짝 저장소의 `API_URL`)도 같은 번호로 맞춰야 해요. |
| DB를 완전히 처음부터 다시 하고 싶어요 | `docker compose down -v`로 DB와 데이터를 지우고, 3·4·5단계를 다시 하세요. (`-v` 없이 `docker compose down`만 하면 데이터는 남아요.) |

## 자주 쓰는 명령 모음

| 하고 싶은 일 | 명령 |
|---|---|
| DB 켜기 / 끄기 | `docker compose up -d` / `docker compose down` |
| DB를 데이터까지 지우기 | `docker compose down -v` |
| 테이블 만들기·갱신 | `npm run build` |
| 예시 데이터 넣기(전부 초기화) | `npm run seed` |
| 개발 서버 켜기 | `npm run dev` |

## 스택

| | |
|---|---|
| 런타임 | Node.js 24 이상 (ESM — `"type": "module"`) |
| 프레임워크 | Express 5 |
| DB | PostgreSQL 18 (Docker) + Prisma 7 |
| 로그인 | 쿠키에 담긴 JWT(Access·Refresh) + 구글·카카오·네이버(OAuth) |
| 실시간 | Socket.IO 4 (DM·입력 중·읽음·알림) |

## 폴더

```
 app.js            서버의 시작 파일
 realtime.js       DM과 알림을 실시간으로 보내는 곳(Socket.IO)
 routes/           주소별 처리 연결
 controllers/      요청을 받아 응답을 만드는 코드
 services/         DB를 다루는 코드
 middlewares/      로그인 확인 같은 공통 처리
 strategies/       소셜 로그인(구글·카카오·네이버)
 schemas/          요청 값 검사(zod)
 prisma/           테이블 정의(schema.prisma)와 마이그레이션 기록
 seed.js           예시 데이터 넣기
 requests/         .http 요청 예시
 public/           DM 시험 화면(dm-test.html)
 compose.yaml      PostgreSQL 컨테이너 설정
 lab/              실습·과제 파일
```
