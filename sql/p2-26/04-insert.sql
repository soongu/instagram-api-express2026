-- Step 8 — 게시물 셋을 넣는다 (이미 올라와 있던 글이라 올린 시각을 직접 적는다)
--   한국 시각 2026-09-28 18:00 을 「지금」으로 잡고 옛 12·45·180분 전만큼 앞선 시각을
--   «세계 표준시(UTC)» 로 적었다 — 도커 PostgreSQL 의 now() 가 UTC 라 같은 기준에 맞춘다.
INSERT INTO posts (username, profile_image, post_image, post_alt, content, like_count, comment_count, created_at)
VALUES
  ('jaehoon', '/images/jaehoon.jpg', '/images/post-1.jpg', '노을 진 한강',     '퇴근길에 한강이 너무 예뻤어요', 128,  4, '2026-09-28 08:48:00'),
  ('minji',   '/images/minji.jpg',   '/images/post-2.jpg', '갓 구운 크루아상', '오늘의 베이킹 성공',            512, 23, '2026-09-28 08:15:00'),
  ('seungwoo','/images/seungwoo.jpg','/images/post-3.jpg', '농구 코트',        '주말 농구 한 판',                76,  8, '2026-09-28 06:00:00');
