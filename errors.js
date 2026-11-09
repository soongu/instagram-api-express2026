// ~/instagram-api/errors.js
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export class NotFoundError extends HttpError {
  constructor(message) {
    super(404, message);
  }
}

export class BadRequestError extends HttpError {
  constructor(message, details) {
    super(400, message);
    this.details = details;
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message) {
    super(401, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message) {
    super(409, message);
  }
}