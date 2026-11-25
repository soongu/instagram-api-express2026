-- ~/instagram-api/lab/p3-60/follows.sql
-- 팔로우 데이터를 채우고 팔로워 수를 행의 수에 맞춘다. 이미 있는 짝은 건너뛴다(ON CONFLICT DO NOTHING).

-- minji 와 jaehoon 을 뺀 모두가 minji 를 팔로우한다. 사용자 이름 차례로 한 시간씩 이른 시각이다.
INSERT INTO follows (follower_id, following_id, created_at)
SELECT u.id,
       (SELECT id FROM users WHERE username = 'minji'),
       TIMESTAMP '2026-11-20 09:00:00' - ROW_NUMBER() OVER (ORDER BY u.username) * INTERVAL '1 hour'
FROM users u
WHERE u.username NOT IN ('minji', 'jaehoon')
ON CONFLICT DO NOTHING;

-- 몇 쌍을 더 넣는다. 서로 팔로우하는 사이도 있다(jaehoon 과 seoyeon · minji 와 dahye · minji 와 seungwoo).
INSERT INTO follows (follower_id, following_id, created_at)
SELECT a.id, b.id, TIMESTAMP '2026-11-10 09:00:00' - pair.n * INTERVAL '1 day'
FROM (VALUES
  (1, 'jaehoon', 'dahye'),
  (2, 'jaehoon', 'seungwoo'),
  (3, 'jaehoon', 'seoyeon'),
  (4, 'jaehoon', 'nayeon'),
  (5, 'seoyeon', 'jaehoon'),
  (6, 'doyun', 'jaehoon'),
  (7, 'boram', 'jaehoon'),
  (8, 'minji', 'jaehoon'),
  (9, 'minji', 'dahye'),
  (10, 'minji', 'seungwoo')
) AS pair(n, follower, following)
JOIN users a ON a.username = pair.follower
JOIN users b ON b.username = pair.following
ON CONFLICT DO NOTHING;

-- 팔로워 수를 follows 의 행 수로 다시 맞춘다. 앞에서 숫자가 어긋났어도 여기서 맞춰진다.
UPDATE users SET follower_count = (SELECT count(*) FROM follows WHERE follows.following_id = users.id);

-- 맞는지 본다 - follower_count 와 세어 본 수가 같아야 한다.
SELECT u.username, u.follower_count, count(f.id) AS followers
FROM users u LEFT JOIN follows f ON f.following_id = u.id
WHERE u.username IN ('minji', 'jaehoon')
GROUP BY u.id
ORDER BY u.username;
