// ~/instagram-api/errors.js

// 에러 코드마다 사람이 읽을 문장 — 프로그램은 코드를 보고, 사람은 문장을 본다.
// 문장은 이 객체에서만 고친다. 코드는 화면이 비교하는 값이라 함부로 바꾸지 않는다.
export const MESSAGES = {
  VALIDATION_FAILED: '보낸 내용이 규칙에 안 맞아요',
  INVALID_BODY: '보낸 내용을 읽을 수 없어요',
  INVALID_CURSOR: '커서 값이 올바르지 않아요',
  NO_IMAGES: '올릴 사진을 골라 주세요',
  NOT_AN_IMAGE: '사진 파일만 올릴 수 있어요',
  IMAGE_TOO_LARGE: '사진 한 장은 5MB까지 올릴 수 있어요',
  UNEXPECTED_FILE: '사진은 images 이름으로 10장까지 보낼 수 있어요',
  UPLOAD_FAILED: '사진을 받지 못했어요',
  IMAGE_NOT_AVAILABLE: '내가 올리고 아직 아무 데도 쓰지 않은 사진만 쓸 수 있어요',
  CANNOT_FOLLOW_SELF: '나 자신은 팔로우할 수 없어요',
  CANNOT_MESSAGE_SELF: '나 자신과는 대화방을 만들 수 없어요',
  HASHTAG_TOO_LONG: '해시태그는 30자까지 쓸 수 있어요',
  TOO_MANY_HASHTAGS: '해시태그는 게시물 하나에 30개까지 쓸 수 있어요',
  REPLY_HAS_NO_REPLIES: '답글에는 답글이 없어요',
  CANNOT_REPLY_TO_REPLY: '답글에는 답글을 달 수 없어요',
  LOGIN_FAILED: '사용자 이름이나 비밀번호가 맞지 않아요',
  SOCIAL_LOGIN_FAILED: '소셜 로그인을 마치지 못했어요',
  LOGIN_REQUIRED: '로그인이 필요해요',
  TOKEN_EXPIRED: '토큰의 기한이 지났어요',
  NOT_POST_AUTHOR: '내가 쓴 게시물만 고치거나 지울 수 있어요',
  CANNOT_REMOVE_COMMENT: '내 댓글이나 내 게시물에 달린 댓글만 지울 수 있어요',
  ADMIN_ONLY: '관리자만 할 수 있어요',
  POST_NOT_FOUND: '그런 게시물은 없어요',
  COMMENT_NOT_FOUND: '그런 댓글은 없어요',
  HASHTAG_NOT_FOUND: '그런 해시태그는 없어요',
  USER_NOT_FOUND: '그런 사용자는 없어요',
  CONVERSATION_NOT_FOUND: '그런 대화방은 없어요',
  NOTIFICATION_NOT_FOUND: '그런 알림은 없어요',
  POST_OR_USER_NOT_FOUND: '그런 게시물이나 사용자는 없어요',
  SOCIAL_ACCOUNT_NOT_FOUND: '연결된 소셜 계정이 없어요',
  ROUTE_NOT_FOUND: '그런 주소는 없어요',
  METHOD_NOT_ALLOWED: '이 주소는 그 HTTP 메서드를 받지 않아요',
  USERNAME_TAKEN: '이미 쓰고 있는 사용자 이름이에요',
  EMAIL_TAKEN: '이미 가입한 이메일이에요',
  PHONE_TAKEN: '이미 가입한 휴대폰 번호예요',
  SOCIAL_ACCOUNT_TAKEN: '이미 다른 계정에 연결된 소셜 계정이에요',
  PROVIDER_ALREADY_LINKED: '같은 제공자의 계정이 이미 연결돼 있어요',
  LAST_LOGIN_METHOD: '마지막 로그인 방법은 끊을 수 없어요',
  INTERNAL_ERROR: '서버에서 문제가 생겼어요',
};

export class HttpError extends Error {
  constructor(status, code) {
    super(MESSAGES[code]);
    this.status = status;
    this.code = code;
  }
}

export class NotFoundError extends HttpError {
  constructor(code) {
    super(404, code);
  }
}

export class BadRequestError extends HttpError {
  constructor(code, details) {
    super(400, code);
    this.details = details;
  }
}

export class UnauthorizedError extends HttpError {
  constructor(code) {
    super(401, code);
  }
}

export class ForbiddenError extends HttpError {
  constructor(code) {
    super(403, code);
  }
}

export class ConflictError extends HttpError {
  constructor(code) {
    super(409, code);
  }
}

export class MethodNotAllowedError extends HttpError {
  constructor(code) {
    super(405, code);
  }
}
