const DEFAULT_METHODS = "GET,HEAD,PUT,PATCH,POST,DELETE";
const DEFAULT_HEADERS = "Content-Type, Authorization";

function normalizeOrigin(origin) {
  if (!origin) {
    return [];
  }

  if (origin === "*") {
    return ["*"];
  }

  if (Array.isArray(origin)) {
    return origin.map(item => (typeof item === "string" ? item : String(item))).filter(Boolean);
  }

  if (typeof origin === "function") {
    return origin;
  }

  return [String(origin)];
}

function handleResult(req, res, next, originResult, options) {
  if (originResult === false) {
    return next();
  }

  if (typeof originResult === "string") {
    res.setHeader("Access-Control-Allow-Origin", originResult);
  } else if (Array.isArray(originResult) && originResult.length > 0) {
    res.setHeader("Access-Control-Allow-Origin", originResult[0]);
  } else if (originResult === true || originResult === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  if (options.credentials) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  const allowMethods = options.methods || DEFAULT_METHODS;
  res.setHeader("Access-Control-Allow-Methods", allowMethods);

  const allowHeaders = options.allowedHeaders || DEFAULT_HEADERS;
  res.setHeader("Access-Control-Allow-Headers", allowHeaders);

  if (options.exposedHeaders) {
    res.setHeader("Access-Control-Expose-Headers", Array.isArray(options.exposedHeaders)
      ? options.exposedHeaders.join(",")
      : options.exposedHeaders);
  }

  if (options.maxAge) {
    res.setHeader("Access-Control-Max-Age", String(options.maxAge));
  }

  if (req.method === "OPTIONS") {
    const status = options.optionsSuccessStatus || 204;
    res.statusCode = status;
    res.end();
    return;
  }

  next();
}

function createCors(options = {}) {
  const origin = normalizeOrigin(options.origin ?? "*");
  const isFunctionOrigin = typeof origin === "function";

  return function corsMiddleware(req, res, next) {
    const requestOrigin = req.headers.origin;

    if (isFunctionOrigin) {
      origin(requestOrigin, (error, allow) => {
        if (error) {
          next(error);
          return;
        }

        handleResult(req, res, next, allow === undefined ? requestOrigin : allow, options);
      });
      return;
    }

    if (!requestOrigin || origin.includes("*")) {
      handleResult(req, res, next, "*", options);
      return;
    }

    if (origin.includes(requestOrigin)) {
      res.setHeader("Vary", "Origin");
      handleResult(req, res, next, requestOrigin, options);
      return;
    }

    if (origin.length === 0) {
      next();
      return;
    }

    res.setHeader("Vary", "Origin");
    handleResult(req, res, next, origin[0], options);
  };
}

module.exports = createCors;
module.exports.default = createCors;
