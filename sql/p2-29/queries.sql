-- p2-29 가 교안·답안에서 «학생이 직접 치는» SQL. 마이그레이션이 뽑아준 것이 아니라
-- VS Code 데이터베이스 연결에 손으로 치는 조회·삽입이라 따로 잠근다.
--   구분자는 p2-26~28 코퍼스와 같은 `-- @@`.
-- @@instagram
SELECT id, username, created_at, updated_at FROM posts ORDER BY id;
