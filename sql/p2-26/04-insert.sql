-- Step 8 — 게시물 셋을 넣는다
INSERT INTO posts (username, profile_image, post_image, post_alt, content, minutes_ago, like_count, comment_count)
VALUES
  ('jaehoon', '/images/jaehoon.jpg', '/images/post-1.jpg', '노을 진 한강',     '퇴근길에 한강이 너무 예뻤어요',  12, 128,  4),
  ('minji',   '/images/minji.jpg',   '/images/post-2.jpg', '갓 구운 크루아상', '오늘의 베이킹 성공',             45, 512, 23),
  ('seungwoo','/images/seungwoo.jpg','/images/post-3.jpg', '농구 코트',        '주말 농구 한 판',               180,  76,  8);
