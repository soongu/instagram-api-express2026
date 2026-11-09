// ~/instagram-api/errors.js

// 에러 코드마다 사람이 읽을 문장 — 프로그램은 코드를 보고, 사람은 문장을 본다.
// 문장은 이 표에서만 고친다. 코드는 화면이 비교하는 값이라 함부로 바꾸지 않는다.
export const MESSAGES = {
  VALIDATION_FAILED: '보낸 내용이 규칙에 안 맞아요',
  INVALID_BODY: '보낸 내용을 읽을 수 없어요',
  INVALID_CURSOR: '커서 값이 올바르지 않아요',
  NO_IMAGES: '올릴 사진을 골라 주세요',
  NOT_AN_IMAGE: '사진 파일만 올릴 수 있어요',
  IMAGE_TOO_LARGE: '사진 한 장은 5MB까지 올릴 수 있어요',
  UNEXPECTED_FILE: '사진은 images 이름으로 10장까지 보낼 수 있어요',
  UPLOAD_FAILED: '사진을 받지 못했어요',
  LOGIN_FAILED: '그런 사용자는 없어요',
  LOGIN_REQUIRED: '로그인이 필요해요',
  POST_NOT_FOUND: '그런 게시물은 없어요',
  USER_NOT_FOUND: '그런 사용자는 없어요',
  POST_OR_USER_NOT_FOUND: '그런 게시물이나 사용자는 없어요',
  ROUTE_NOT_FOUND: '그런 주소는 없어요',
  METHOD_NOT_ALLOWED: '이 주소는 그 HTTP 메서드를 받지 않아요',
  USERNAME_TAKEN: '이미 쓰고 있는 사용자 이름이에요',
  EMAIL_TAKEN: '이미 가입한 이메일이에요',
  PHONE_TAKEN: '이미 가입한 휴대폰 번호예요',
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
