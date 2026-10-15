(function (global) {
  "use strict";

  class ApiError extends Error {
    constructor(message, details) {
      super(message);
      this.name = "ApiError";
      this.status = details.status;
      this.code = details.code;
      this.cause = details.cause;
    }
  }

  function getSafeErrorMessage(error) {
    const message = typeof error === "string"
      ? error
      : error && typeof error.message === "string"
        ? error.message
        : "";

    if (!message || /(?:\bat\s+[\w$.<>]+\s*\(|\bstack\s*trace\b|\btraceback\b|\bsqlstate\b|\bsql\b|\n\s*#\d+\s|\b(?:select\b.+\bfrom\b|insert\s+into\b|update\s+\w+\s+set\b|delete\s+from\b|drop\s+(?:table|database)\b|alter\s+table\b|create\s+(?:table|database)\b|truncate\s+table\b))/is.test(message)) {
      return "Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại.";
    }

    return message;
  }

  async function apiRequest(url, options) {
    const settings = options || {};
    const method = (settings.method || "GET").toUpperCase();
    const timeout = settings.timeout === undefined ? 10000 : Number(settings.timeout);

    if (method !== "GET" && method !== "POST") {
      throw new TypeError("apiRequest chỉ hỗ trợ GET và POST.");
    }
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new TypeError("timeout phải là số dương.");
    }

    const headers = new Headers(settings.headers || {});
    const request = {
      method: method,
      headers: headers,
      credentials: settings.credentials || "same-origin"
    };

    if (method === "POST" && settings.body !== undefined) {
      if (settings.body instanceof FormData || typeof settings.body === "string") {
        request.body = settings.body;
      } else {
        headers.set("Content-Type", "application/json");
        request.body = JSON.stringify(settings.body);
      }
    }

    const controller = new AbortController();
    request.signal = controller.signal;
    const timeoutId = global.setTimeout(function () {
      controller.abort();
    }, timeout);

    try {
      let response;
      response = await global.fetch(url, request);

      let payload = null;
      let parseError;
      try {
        payload = await response.json();
      } catch (cause) {
        if (controller.signal.aborted) {
          throw cause;
        }
        parseError = cause;
      }
      if (parseError) {
        throw new ApiError(
          response.ok
            ? "Máy chủ trả về dữ liệu không hợp lệ."
            : "Máy chủ không thể xử lý yêu cầu.",
          { status: response.status, cause: parseError }
        );
      }

      if (!response.ok) {
        const serverError = payload && payload.error;
        throw new ApiError(getSafeErrorMessage(serverError), {
          status: response.status,
          code: serverError && typeof serverError === "object" ? serverError.code : undefined
        });
      }

      if (!payload || typeof payload !== "object" || typeof payload.success !== "boolean") {
        throw new ApiError("Máy chủ trả về dữ liệu không đúng định dạng.", { status: response.status });
      }

      if (!payload.success) {
        throw new ApiError(getSafeErrorMessage(payload.error), {
          status: response.status,
          code: payload.error && typeof payload.error === "object" ? payload.error.code : undefined
        });
      }

      return payload.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw new ApiError("Yêu cầu đã hết thời gian chờ.", { cause: error });
      }
      if (error instanceof TypeError) {
        throw new ApiError("Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.", { cause: error });
      }
      throw new ApiError("Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại.", { cause: error });
    } finally {
      global.clearTimeout(timeoutId);
    }
  }

  global.apiRequest = apiRequest;
  global.ApiError = ApiError;
})(window);
