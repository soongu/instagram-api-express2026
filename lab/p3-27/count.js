// ~/instagram-api/lab/count.js
const notFound = (req, res) => {};
const parseId = (req, res, next) => {};
const onError = (err, req, res, next) => {};

console.log(notFound.length, parseId.length, onError.length);

const withDefault = (err, req, res, next = () => {}) => {};
const withRest = (...args) => {};

console.log(withDefault.length, withRest.length);
