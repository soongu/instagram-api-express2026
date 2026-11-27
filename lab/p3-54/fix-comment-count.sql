-- ~/instagram-api/lab/p3-54/fix-comment-count.sql
-- 게시물마다 적힌 댓글 수(comment_count)를 실제 원댓글 수로 다시 맞춘다. 답글은 세지 않는다.
-- updated_at 은 건드리지 않는다. 숫자를 맞추는 일은 게시물을 고친 게 아니다.
-- 지금 원댓글을 세어 그 값을 적으므로 몇 번 실행해도 결과가 같다.
UPDATE posts
SET comment_count = (
  SELECT count(*)
  FROM comments
  WHERE comments.post_id = posts.id AND comments.parent_id IS NULL
);

-- 게시물마다 적힌 숫자와 실제 원댓글 수를 나란히 본다. 모든 줄에서 두 값이 같아야 한다.
SELECT posts.id,
       posts.comment_count,
       (SELECT count(*) FROM comments WHERE comments.post_id = posts.id AND comments.parent_id IS NULL) AS root_comments
FROM posts
ORDER BY posts.id;
