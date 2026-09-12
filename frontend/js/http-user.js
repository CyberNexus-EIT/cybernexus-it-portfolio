/*
 * CyberNexus IT Portfolio Platform
 * File: frontend/js/http-user.js
 *
 * Responsibility:
 * - Generic HTTP transport
 * - Request configuration
 * - URL resolution
 * - Headers and request bodies
 * - Timeout and cancellation
 * - Response parsing
 * - HTTP/network error normalization
 * - Safe retry handling
 *
 * Does NOT own:
 * - API endpoint definitions
 * - Authentication
 * - Account operations
 * - Application state
 * - DOM/UI logic
 * - Chat/AI operations
 * - Voice operations
 */

(function (window) {
    "use strict";

    /* =======================================================
       NAMESPACE
    ======================================================= */

    const CyberNexus =
        (window.CyberNexus =
            window.CyberNexus || {});

    /* =======================================================
       CONSTANTS
    ======================================================= */

    const DEFAULT_TIMEOUT = 15000;
    const DEFAULT_RETRIES = 0;
    const DEFAULT_RETRY_DELAY = 500;

    const RETRYABLE_METHODS = Object.freeze(
        new Set([
            "GET",
            "HEAD",
            "OPTIONS"
        ])
    );

    const RETRYABLE_STATUS_CODES =
        Object.freeze(
            new Set([
                408,
                425,
                429,
                500,
                502,
                503,
                504
            ])
        );

    /* =======================================================
       SETTINGS
    ======================================================= */

    const settings = {
        baseUrl: "",
        timeout: DEFAULT_TIMEOUT,
        retries: DEFAULT_RETRIES,
        retryDelay: DEFAULT_RETRY_DELAY
    };

    /* =======================================================
       RUNTIME CONFIGURATION
    ======================================================= */

    function getRuntimeConfig() {
        const runtime =
            window.__CYBERNEXUS_CONFIG__;

        if (
            runtime &&
            typeof runtime === "object" &&
            !Array.isArray(runtime)
        ) {
            return runtime;
        }

        const namespaceConfig =
            CyberNexus.Config;

        if (
            namespaceConfig &&
            typeof namespaceConfig === "object" &&
            !Array.isArray(namespaceConfig)
        ) {
            return namespaceConfig;
        }

        return {};
    }

    function getStateEndpoint() {
        const state =
            CyberNexus.State;

        if (
            !state ||
            typeof state.get !== "function"
        ) {
            return "";
        }

        const endpoint =
            state.get(
                "connection.endpoint"
            );

        return typeof endpoint === "string"
            ? endpoint.trim()
            : "";
    }

    function resolveBaseUrl() {
        const config =
            getRuntimeConfig();

        const configured =
            config.apiBaseUrl ||
            config.apiBaseURL ||
            config.apiEndpoint ||
            "";

        if (
            typeof configured === "string" &&
            configured.trim()
        ) {
            return configured.trim();
        }

        return getStateEndpoint();
    }

    function configure(options) {
        const value =
            options &&
            typeof options === "object" &&
            !Array.isArray(options)
                ? options
                : {};

        if (
            typeof value.baseUrl === "string"
        ) {
            settings.baseUrl =
                value.baseUrl.trim();
        }

        if (
            Number.isFinite(value.timeout) &&
            value.timeout >= 0
        ) {
            settings.timeout =
                value.timeout;
        }

        if (
            Number.isInteger(value.retries) &&
            value.retries >= 0
        ) {
            settings.retries =
                value.retries;
        }

        if (
            Number.isFinite(
                value.retryDelay
            ) &&
            value.retryDelay >= 0
        ) {
            settings.retryDelay =
                value.retryDelay;
        }

        return getConfig();
    }

    function getConfig() {
        return Object.freeze({
            baseUrl:
                settings.baseUrl ||
                resolveBaseUrl(),

            timeout:
                settings.timeout,

            retries:
                settings.retries,

            retryDelay:
                settings.retryDelay
        });
    }

    /* =======================================================
       NORMALIZATION
    ======================================================= */

    function normalizeMethod(method) {
        return String(
            method || "GET"
        )
            .trim()
            .toUpperCase();
    }

    function normalizeHeaders(headers) {
        const result = {};

        if (!headers) {
            return result;
        }

        if (
            typeof Headers !== "undefined" &&
            headers instanceof Headers
        ) {
            headers.forEach(
                function (value, key) {
                    result[key] = value;
                }
            );

            return result;
        }

        if (
            typeof headers === "object" &&
            !Array.isArray(headers)
        ) {
            Object.keys(headers).forEach(
                function (key) {
                    const value =
                        headers[key];

                    if (
                        value !== undefined &&
                        value !== null
                    ) {
                        result[key] =
                            String(value);
                    }
                }
            );
        }

        return result;
    }

    function hasHeader(
        headers,
        name
    ) {
        const target =
            String(name).toLowerCase();

        return Object.keys(headers).some(
            function (key) {
                return (
                    key.toLowerCase() ===
                    target
                );
            }
        );
    }

    function joinUrl(
        baseUrl,
        path
    ) {
        const target =
            String(path || "").trim();

        const base =
            String(baseUrl || "").trim();

        if (!target) {
            return base;
        }

        if (
            /^https?:\/\//i.test(target) ||
            /^\/\//.test(target)
        ) {
            return target;
        }

        if (!base) {
            return target;
        }

        return (
            base.replace(/\/+$/, "") +
            "/" +
            target.replace(/^\/+/, "")
        );
    }

    /* =======================================================
       REQUEST BODY
    ======================================================= */

    function isBodyInstance(
        body
    ) {
        return (
            (
                typeof Blob !== "undefined" &&
                body instanceof Blob
            ) ||
            (
                typeof FormData !== "undefined" &&
                body instanceof FormData
            ) ||
            (
                typeof URLSearchParams !==
                    "undefined" &&
                body instanceof URLSearchParams
            ) ||
            (
                typeof ArrayBuffer !==
                    "undefined" &&
                body instanceof ArrayBuffer
            ) ||
            (
                typeof ArrayBuffer !==
                    "undefined" &&
                typeof ArrayBuffer.isView ===
                    "function" &&
                ArrayBuffer.isView(body)
            )
        );
    }

    function prepareBody(
        body,
        headers
    ) {
        if (
            body === undefined ||
            body === null
        ) {
            return undefined;
        }

        if (
            typeof body === "string" ||
            isBodyInstance(body)
        ) {
            return body;
        }

        if (
            typeof body === "object"
        ) {
            if (
                !hasHeader(
                    headers,
                    "Content-Type"
                )
            ) {
                headers["Content-Type"] =
                    "application/json";
            }

            return JSON.stringify(body);
        }

        return String(body);
    }

    /* =======================================================
       ABORT / TIMEOUT
    ======================================================= */

    function createAbortController(
        timeout,
        externalSignal
    ) {
        if (
            typeof AbortController ===
            "undefined"
        ) {
            return {
                signal:
                    externalSignal || undefined,

                timedOut:
                    function () {
                        return false;
                    },

                externallyAborted:
                    function () {
                        return Boolean(
                            externalSignal &&
                            externalSignal.aborted
                        );
                    },

                cleanup:
                    function () {}
            };
        }

        const controller =
            new AbortController();

        let timeoutId = null;
        let abortHandler = null;
        let timedOut = false;
        let externallyAborted =
            Boolean(
                externalSignal &&
                externalSignal.aborted
            );

        if (
            Number.isFinite(timeout) &&
            timeout > 0
        ) {
            timeoutId =
                window.setTimeout(
                    function () {
                        timedOut = true;
                        controller.abort();
                    },
                    timeout
                );
        }

        if (externalSignal) {
            if (
                externalSignal.aborted
            ) {
                externallyAborted = true;
                controller.abort();
            } else if (
                typeof externalSignal.addEventListener ===
                "function"
            ) {
                abortHandler =
                    function () {
                        externallyAborted =
                            true;

                        controller.abort();
                    };

                externalSignal.addEventListener(
                    "abort",
                    abortHandler,
                    {
                        once: true
                    }
                );
            }
        }

        return {
            signal:
                controller.signal,

            timedOut:
                function () {
                    return timedOut;
                },

            externallyAborted:
                function () {
                    return externallyAborted;
                },

            cleanup:
                function () {
                    if (
                        timeoutId !== null
                    ) {
                        window.clearTimeout(
                            timeoutId
                        );
                    }

                    if (
                        externalSignal &&
                        abortHandler &&
                        typeof externalSignal.removeEventListener ===
                            "function"
                    ) {
                        externalSignal.removeEventListener(
                            "abort",
                            abortHandler
                        );
                    }
                }
        };
    }

    /* =======================================================
       RESPONSE PARSING
    ======================================================= */

    async function parseResponse(
        response
    ) {
        if (
            response.status === 204 ||
            response.status === 205
        ) {
            return null;
        }

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        const text =
            await response.text();

        if (!text) {
            return null;
        }

        if (
            contentType.includes(
                "application/json"
            ) ||
            contentType.includes(
                "+json"
            )
        ) {
            try {
                return JSON.parse(text);
            } catch (error) {
                return text;
            }
        }

        return text;
    }

    /* =======================================================
       ERRORS
    ======================================================= */

    async function createHttpError(
        response,
        url,
        method
    ) {
        let data = null;

        try {
            data =
                await parseResponse(
                    response
                );
        } catch (error) {
            data = null;
        }

        let message =
            "HTTP request failed.";

        if (
            data &&
            typeof data === "object" &&
            !Array.isArray(data)
        ) {
            message =
                data.message ||
                data.error ||
                data.detail ||
                message;
        } else if (
            typeof data === "string" &&
            data.trim()
        ) {
            message =
                data.trim();
        } else if (
            response.statusText
        ) {
            message =
                response.statusText;
        }

        const error =
            new Error(message);

        error.name =
            "HttpError";

        error.status =
            response.status;

        error.statusText =
            response.statusText || "";

        error.method =
            method;

        error.url =
            url;

        error.data =
            data;

        error.ok = false;

        return error;
    }

    function createNetworkError(
        error,
        request,
        abortControl
    ) {
        const timedOut =
            abortControl &&
            typeof abortControl.timedOut ===
                "function"
                ? abortControl.timedOut()
                : false;

        const externallyAborted =
            abortControl &&
            typeof abortControl.externallyAborted ===
                "function"
                ? abortControl.externallyAborted()
                : Boolean(
                      error &&
                      error.name ===
                          "AbortError"
                  );

        let message =
            "Unable to connect to the server.";

        let name =
            "HttpNetworkError";

        if (timedOut) {
            message =
                "The HTTP request timed out.";

            name =
                "HttpTimeoutError";
        } else if (
            externallyAborted
        ) {
            message =
                "The HTTP request was aborted.";

            name =
                "HttpAbortError";
        }

        const normalized =
            new Error(message);

        normalized.name =
            name;

        normalized.originalError =
            error;

        normalized.method =
            request.method;

        normalized.url =
            request.url;

        normalized.status = 0;

        normalized.statusText = "";

        normalized.ok = false;

        normalized.timedOut =
            timedOut;

        normalized.aborted =
            externallyAborted;

        return normalized;
    }

    /* =======================================================
       RETRY
    ======================================================= */

    function shouldRetry(
        method,
        response,
        attempt,
        retries
    ) {
        if (
            attempt >= retries
        ) {
            return false;
        }

        if (
            !RETRYABLE_METHODS.has(
                method
            )
        ) {
            return false;
        }

        if (!response) {
            return true;
        }

        return RETRYABLE_STATUS_CODES.has(
            response.status
        );
    }

    function wait(
        milliseconds
    ) {
        if (
            !milliseconds ||
            milliseconds <= 0
        ) {
            return Promise.resolve();
        }

        return new Promise(
            function (resolve) {
                window.setTimeout(
                    resolve,
                    milliseconds
                );
            }
        );
    }

    /* =======================================================
       REQUEST EXECUTION
    ======================================================= */

    async function execute(
        request
    ) {
        for (
            let attempt = 0;
            attempt <= request.retries;
            attempt += 1
        ) {
            let abortControl = null;

            try {
                abortControl =
                    createAbortController(
                        request.timeout,
                        request.signal
                    );

                if (
                    abortControl.externallyAborted()
                ) {
                    const abortedError =
                        new Error(
                            "The HTTP request was aborted."
                        );

                    abortedError.name =
                        "HttpAbortError";

                    throw abortedError;
                }

                const response =
                    await fetch(
                        request.url,
                        {
                            method:
                                request.method,

                            headers:
                                request.headers,

                            body:
                                request.body,

                            credentials:
                                request.credentials,

                            mode:
                                request.mode,

                            cache:
                                request.cache,

                            redirect:
                                request.redirect,

                            referrerPolicy:
                                request.referrerPolicy,

                            signal:
                                abortControl.signal
                        }
                    );

                if (!response.ok) {
                    if (
                        shouldRetry(
                            request.method,
                            response,
                            attempt,
                            request.retries
                        )
                    ) {
                        await wait(
                            request.retryDelay *
                                Math.pow(
                                    2,
                                    attempt
                                )
                        );

                        continue;
                    }

                    throw await createHttpError(
                        response,
                        request.url,
                        request.method
                    );
                }

                const data =
                    await parseResponse(
                        response
                    );

                return {
                    ok: true,

                    status:
                        response.status,

                    statusText:
                        response.statusText ||
                        "",

                    headers:
                        response.headers,

                    data:
                        data,

                    response:
                        response,

                    url:
                        request.url,

                    method:
                        request.method,

                    attempts:
                        attempt + 1
                };
            } catch (error) {
                if (
                    error &&
                    (
                        error.name ===
                            "HttpError" ||
                        error.name ===
                            "HttpAbortError"
                    )
                ) {
                    throw error;
                }

                const timedOut =
                    abortControl &&
                    abortControl.timedOut();

                const externallyAborted =
                    abortControl &&
                    abortControl.externallyAborted();

                /*
                 * Timeout and caller cancellation
                 * are terminal conditions.
                 *
                 * They must never be retried.
                 */
                if (
                    timedOut ||
                    externallyAborted
                ) {
                    throw createNetworkError(
                        error,
                        request,
                        abortControl
                    );
                }

                /*
                 * Network failures may be retried
                 * only for explicitly retryable
                 * HTTP methods.
                 */
                if (
                    shouldRetry(
                        request.method,
                        null,
                        attempt,
                        request.retries
                    )
                ) {
                    await wait(
                        request.retryDelay *
                            Math.pow(
                                2,
                                attempt
                            )
                    );

                    continue;
                }

                throw createNetworkError(
                    error,
                    request,
                    abortControl
                );
            } finally {
                if (abortControl) {
                    abortControl.cleanup();
                }
            }
        }

        throw new Error(
            "HTTP request failed."
        );
    }

    /* =======================================================
       PUBLIC REQUEST
    ======================================================= */

    async function request(
        url,
        options
    ) {
        const value =
            options &&
            typeof options === "object" &&
            !Array.isArray(options)
                ? options
                : {};

        const method =
            normalizeMethod(
                value.method
            );

        const baseUrl =
            value.baseUrl !==
            undefined
                ? String(
                      value.baseUrl || ""
                  ).trim()
                : (
                    settings.baseUrl ||
                    resolveBaseUrl()
                );

        const requestUrl =
            joinUrl(
                baseUrl,
                url
            );

        if (!requestUrl) {
            throw new Error(
                "HTTP request URL is required."
            );
        }

        const headers =
            normalizeHeaders(
                value.headers
            );

        const body =
            prepareBody(
                value.body,
                headers
            );

        return execute({
            method:
                method,

            url:
                requestUrl,

            headers:
                headers,

            body:
                body,

            timeout:
                Number.isFinite(
                    value.timeout
                )
                    ? Math.max(
                          0,
                          value.timeout
                      )
                    : settings.timeout,

            retries:
                Number.isInteger(
                    value.retries
                )
                    ? Math.max(
                          0,
                          value.retries
                      )
                    : settings.retries,

            retryDelay:
                Number.isFinite(
                    value.retryDelay
                )
                    ? Math.max(
                          0,
                          value.retryDelay
                      )
                    : settings.retryDelay,

            signal:
                value.signal || null,

            credentials:
                value.credentials ||
                "same-origin",

            mode:
                value.mode ||
                "cors",

            cache:
                value.cache ||
                "default",

            redirect:
                value.redirect ||
                "follow",

            referrerPolicy:
                value.referrerPolicy ||
                "strict-origin-when-cross-origin"
        });
    }

    /* =======================================================
       HTTP METHODS
    ======================================================= */

    function get(
        url,
        options
    ) {
        return request(
            url,
            Object.assign(
                {},
                options,
                {
                    method: "GET"
                }
            )
        );
    }

    function post(
        url,
        body,
        options
    ) {
        return request(
            url,
            Object.assign(
                {},
                options,
                {
                    method: "POST",
                    body: body
                }
            )
        );
    }

    function put(
        url,
        body,
        options
    ) {
        return request(
            url,
            Object.assign(
                {},
                options,
                {
                    method: "PUT",
                    body: body
                }
            )
        );
    }

    function patch(
        url,
        body,
        options
    ) {
        return request(
            url,
            Object.assign(
                {},
                options,
                {
                    method: "PATCH",
                    body: body
                }
            )
        );
    }

    function remove(
        url,
        options
    ) {
        return request(
            url,
            Object.assign(
                {},
                options,
                {
                    method: "DELETE"
                }
            )
        );
    }

    function head(
        url,
        options
    ) {
        return request(
            url,
            Object.assign(
                {},
                options,
                {
                    method: "HEAD"
                }
            )
        );
    }

    function optionsRequest(
        url,
        options
    ) {
        return request(
            url,
            Object.assign(
                {},
                options,
                {
                    method: "OPTIONS"
                }
            )
        );
    }

    /* =======================================================
       BASE URL
    ======================================================= */

    function setBaseUrl(
        baseUrl
    ) {
        settings.baseUrl =
            typeof baseUrl === "string"
                ? baseUrl.trim()
                : "";

        return settings.baseUrl;
    }

    function getBaseUrl() {
        return (
            settings.baseUrl ||
            resolveBaseUrl()
        );
    }

    /* =======================================================
       PUBLIC API
    ======================================================= */

    const Http =
        Object.freeze({
            request,

            get,
            post,
            put,
            patch,
            delete: remove,
            head,
            options:
                optionsRequest,

            configure,
            getConfig,

            setBaseUrl,
            getBaseUrl
        });

    CyberNexus.Http =
        Http;

    window.CyberNexusHttp =
        Http;

})(window);
