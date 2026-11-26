-- ~/instagram-api/lab/p3-63/messages.sql
-- jaehoon 의 대화방을 둘 더 만들고, 메시지를 넣는다.

-- jaehoon(2) 과 minji(3), jaehoon(2) 과 doyun(44) 의 대화방 - 작은 번호가 a 자리다.
INSERT INTO conversations (participant_a_id, participant_b_id, created_at) VALUES
  (2, 3, now() - interval '3 days'),
  (2, 44, now() - interval '1 day');

-- 메시지 일곱 줄 - other_id 는 jaehoon 의 상대, ago 는 지금부터 얼마 전에 보냈는지다.
-- doyun 과의 방에는 아직 메시지가 없다.
INSERT INTO direct_messages (conversation_id, sender_id, content, created_at)
SELECT c.id, m.sender_id, m.content, now() - m.ago
FROM (VALUES
  (3, 3, '다음 주 스터디 몇 시에 해요?', interval '2 days 1 hour'),
  (3, 2, '저녁 7시요!', interval '2 days'),
  (43, 43, '한강 사진 정말 예뻐요! 어디서 찍었어요?', interval '12 minutes'),
  (43, 2, '반포대교 아래에서요. 해 질 때 가면 좋아요', interval '10 minutes'),
  (43, 43, '이번 주말에 가 봐야겠어요', interval '8 minutes'),
  (43, 2, '가면 사진 보여 주세요', interval '6 minutes'),
  (43, 43, '네, 꼭요!', interval '5 minutes')
) AS m(other_id, sender_id, content, ago)
JOIN conversations c ON c.participant_a_id = 2 AND c.participant_b_id = m.other_id
-- 오래전에 보낸 것부터 넣는다 - 메시지 번호도 보낸 차례대로 붙는다.
ORDER BY m.ago DESC;
