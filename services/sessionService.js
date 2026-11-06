// ~/instagram-api/services/sessionService.js
import { randomUUID } from 'node:crypto';

// 세션 ID → 사람의 번호. 서버의 메모리에만 있어서 서버가 다시 뜨면 비어 있다.
const sessions = new Map();

export function createSession(userId) {
  const sessionId = randomUUID();
  sessions.set(sessionId, userId);
  return sessionId;
}

// 서버가 기억해 둔 세션이 없으면 undefined 가 나온다.
export function getUserId(sessionId) {
  return sessions.get(sessionId);
}

export function deleteSession(sessionId) {
  sessions.delete(sessionId);
}