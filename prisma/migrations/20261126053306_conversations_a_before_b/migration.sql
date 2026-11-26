-- 대화방의 a 자리에는 언제나 작은 번호가 온다.
-- 서버가 차례를 정해 넣지만, 다른 길(SQL · 다른 코드)로 넣는 행도 막으려고 표에도 적는다.
-- 같은 번호(나 자신과의 방)도 «작다» 가 아니라서 함께 막힌다.
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_a_before_b" CHECK ("participant_a_id" < "participant_b_id");
