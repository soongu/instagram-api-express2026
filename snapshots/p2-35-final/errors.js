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
