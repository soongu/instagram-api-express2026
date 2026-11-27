-- ~/instagram-api/lab/p3-66/many-messages.sql
-- 7번 대화방(jaehoon 과 minji)에 옛 메시지 60개를 더한다.
-- 보낸 사람은 jaehoon 셋, minji 셋이 번갈아 맡고 글에는 차례 번호가 붙는다(1번째가 가장 오래된 메시지).
-- 시각은 1분 간격이다. 60번째가 이 방의 첫 메시지보다 1분 이르고 앞의 메시지일수록 1분씩 이르다.
-- 마지막 메시지보다 이른 메시지라 대화방 행의 마지막 메시지는 고치지 않는다.
INSERT INTO direct_messages (conversation_id, sender_id, content, created_at)
SELECT 7,
       users.id,
       n || '번째 메시지',
       (SELECT min(created_at) FROM direct_messages WHERE conversation_id = 7) - (61 - n) * INTERVAL '1 minute'
FROM generate_series(1, 60) AS n
JOIN users ON users.username = CASE WHEN (n - 1) / 3 % 2 = 0 THEN 'jaehoon' ELSE 'minji' END
-- 적은 차례대로 넣는다. 오래된 메시지일수록 번호도 작다.
ORDER BY n;
