-- ~/instagram-api/lab/p3-55/many-replies.sql
-- 2번 게시물의 4번 댓글(jaehoon 의 «크루아상 색이 좋네요»)에 답글 300개를 더한다.
-- 글쓴이는 minji · dahye · nayeon · seungwoo · jaehoon 다섯이 돌아가며 맡고 글은 열 개가 차례로 돈다.
-- 시각은 1분 간격이다. 마지막 답글이 지금이고 앞의 답글일수록 1분씩 이르다.
INSERT INTO comments (post_id, parent_id, author_id, content, created_at, updated_at)
SELECT 2, 4, users.id, replies.content,
       now() - (300 - n) * INTERVAL '1 minute',
       now() - (300 - n) * INTERVAL '1 minute'
FROM generate_series(1, 300) AS n
JOIN (VALUES
  (1, 'minji', '고마워요, 오늘 아침에 구웠어요'),
  (2, 'dahye', '버터 향이 여기까지 나는 것 같아요'),
  (3, 'nayeon', '저도 색 보고 놀랐어요'),
  (4, 'seungwoo', '빵집에서 파는 것 같아요'),
  (5, 'jaehoon', '그쵸, 색이 제일 먼저 보였어요'),
  (6, 'minji', '다음엔 더 진하게 구워 볼게요'),
  (7, 'dahye', '오븐 몇 도였는지 궁금해요'),
  (8, 'nayeon', '한 입 먹어 보고 싶어요'),
  (9, 'seungwoo', '사진도 잘 찍으셨네요'),
  (10, 'jaehoon', '다들 같은 생각이네요')
) AS replies(k, username, content) ON replies.k = (n - 1) % 10 + 1
JOIN users ON users.username = replies.username
-- 적은 차례대로 넣는다. 늦게 단 답글일수록 번호도 크다.
ORDER BY n;

-- 답글은 게시물의 댓글 수에 세지 않는다. 그래서 comment_count 는 고치지 않는다.

-- 4번 댓글의 답글 수와 2번 게시물의 두 숫자를 확인한다. 뒤의 두 값은 같아야 한다.
SELECT (SELECT count(*) FROM comments WHERE parent_id = 4) AS replies,
       comment_count,
       (SELECT count(*) FROM comments WHERE post_id = 2 AND parent_id IS NULL) AS root_comments
FROM posts
WHERE id = 2;
