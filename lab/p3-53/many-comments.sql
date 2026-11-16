-- ~/instagram-api/lab/p3-53/many-comments.sql
-- 2번 게시물(minji 의 크루아상)에 원댓글 25개를 더한다. 글쓴이는 jaehoon · minji · dahye · nayeon · seungwoo · sora 여섯이 돌아가며 맡는다.
-- 시각은 1분 간격이다 — 마지막 댓글이 지금이고, 앞의 댓글일수록 1분씩 이르다.
INSERT INTO comments (post_id, author_id, content, created_at, updated_at)
SELECT 2, users.id, new_comments.content,
       now() - (25 - new_comments.n) * INTERVAL '1 minute',
       now() - (25 - new_comments.n) * INTERVAL '1 minute'
FROM (VALUES
  (1, 'jaehoon', '겉이 바삭해 보여요'),
  (2, 'minji', '오늘은 버터를 넉넉히 넣었어요'),
  (3, 'dahye', '반죽은 몇 번 접어요?'),
  (4, 'nayeon', '아침부터 배고파지네요'),
  (5, 'seungwoo', '커피랑 같이 먹고 싶어요'),
  (6, 'sora', '빵집에서 산 줄 알았어요'),
  (7, 'jaehoon', '다음엔 저도 하나 주세요'),
  (8, 'minji', '반죽은 세 번 접었어요'),
  (9, 'dahye', '오븐 온도가 궁금해요'),
  (10, 'nayeon', '사진 색감이 따뜻해요'),
  (11, 'seungwoo', '주말에 따라 해 볼게요'),
  (12, 'sora', '초코 크루아상도 만들어 주세요'),
  (13, 'jaehoon', '보기만 해도 고소해요'),
  (14, 'minji', '오븐은 200도로 맞췄어요'),
  (15, 'dahye', '버터는 어디서 사요?'),
  (16, 'nayeon', '하나만 먹고 끝낼 수 없겠어요'),
  (17, 'seungwoo', '몇 개나 구웠어요?'),
  (18, 'sora', '속이 촉촉해 보여요'),
  (19, 'jaehoon', '저도 오늘 빵 사러 가야겠어요'),
  (20, 'minji', '열두 개 구웠어요'),
  (21, 'dahye', '잼이랑 먹어도 맛있겠어요'),
  (22, 'nayeon', '구운 색이 정말 고르네요'),
  (23, 'seungwoo', '다음 빵도 기대할게요'),
  (24, 'sora', '저도 굽는 법을 배우고 싶어요'),
  (25, 'jaehoon', '아침으로 딱이네요')
) AS new_comments(n, username, content)
JOIN users ON users.username = new_comments.username
-- 적은 차례대로 넣는다 — 늦게 단 댓글일수록 번호도 크다.
ORDER BY new_comments.n;

-- 카드의 «댓글 N개 보기» 는 posts 의 comment_count 를 읽는다 — 더한 원댓글 수만큼 함께 올린다.
UPDATE posts SET comment_count = comment_count + 25 WHERE id = 2;

-- 확인 — 두 숫자가 같아야 한다. 처음 한 번 실행했으면 둘 다 29 다.
SELECT comment_count,
       (SELECT count(*) FROM comments WHERE post_id = 2 AND parent_id IS NULL) AS root_comments
FROM posts
WHERE id = 2;
