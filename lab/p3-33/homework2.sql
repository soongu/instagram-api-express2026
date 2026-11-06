-- ~/instagram-api/lab/p3-33/homework2.sql
-- 1. 좋아요 수를 0~49999 로 흩어 놓는다. 값마다 게시물이 2개쯤이라 동률도 생긴다.
UPDATE posts SET like_count = id * 7919 % 50000;

-- 2. 인기순 정렬과 같은 순서의 인덱스를 만든다.
CREATE INDEX lab_popular ON posts (like_count DESC, id DESC);

-- 3. 통계를 새로 모은다.
ANALYZE posts;
