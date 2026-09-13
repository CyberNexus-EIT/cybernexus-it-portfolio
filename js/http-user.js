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

    /* ==========================================================================
       NAMESPACE
       ========================================================================== */

    const CyberNexus =
        (window.CyberNexus =
            window.CyberNexus || {});

    /* ==========================================================================
       CONSTANTS
       ========================================================================== */

    const DEFAULT_TIMEOUT = 15000;
    const DEFAULT_RETRIES = 0;
    const DEFAULT_RETRY_DELAY = 500;
    const DEFAULT_MAX_RETRY_DELAY = 10000;

    const DEFAULT_CREDENTIALS =
        "same-origin";

    const DEFAULT_MODE =
        "cors";

    const DEFAULT_CACHE =
        "default";

    const DEFAULT_REDIRECT =
        "follow";

    const DEFAULT_REFERRER_POLICY =
        "strict-origin-when-cross-origin";

    const RETRYABLE_METHODS =
        Object.freeze(
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

    const JSON_CONTENT_TYPES =
        Object.freeze(
            new Set([
                "application/json"
            ])
        );

    /* ==========================================================================
       SETTINGS
       ========================================================================== */

    const settings = {
        baseUrl: "",
        timeout: DEFAULT_TIMEOUT,
        retries: DEFAULT_RETRIES,
        retryDelay: DEFAULT_RETRY_DELAY,
        maxRetryDelay:
            DEFAULT_MAX_RETRY_DELAY
    };

    /* ==========================================================================
       OBJECT HELPERS
       ========================================================================== */

    function isObject(value) {
        return (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
        );
    }

    function isPlainObject(value) {
        if (!isObject(value)) {
            return false;
        }

        const prototype =
            Object.getPrototypeOf(
                value
            );

        return (
            prototype ===
                Object.prototype ||
            prototype === null
        );
    }

    /* ==========================================================================
       RUNTIME CONFIGURATION
       ========================================================================== */

    function getRuntimeConfig() {
        const runtime =
            window.__CYBERNEXUS_CONFIG__;

        if (isObject(runtime)) {
            return runtime;
        }

        const namespaceConfig =
            CyberNexus.Config;

        if (isObject(namespaceConfig)) {
            return namespaceConfig;
        }

        return {};
    }

    function getStateEndpoint() {
        const State =
            CyberNexus.State ||
            window.CyberNexusState;

        if (
            !State ||
            typeof State.get !==
                "function"
        ) {
            return "";
        }

        const endpoint =
            State.get(
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

    /* ==========================================================================
       CONFIGURATION
       ========================================================================== */

    function configure(options) {
        const value =
            isObject(options)
                ? options
                : {};

        if (
            Object.prototype.hasOwnProperty.call(
                value,
                "baseUrl"
            )
        ) {
            settings.baseUrl =
                typeof value.baseUrl ===
                "string"
                    ? value.baseUrl.trim()
                    : "";
        }

        if (
            Number.isFinite(
                value.timeout
            ) &&
            value.timeout >= 0
        ) {
            settings.timeout =
                value.timeout;
        }

        if (
            Number.isInteger(
                value.retries
            ) &&
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

        if (
            Number.isFinite(
                value.maxRetryDelay
            ) &&
            value.maxRetryDelay >= 0
        ) {
            settings.maxRetryDelay =
                value.maxRetryDelay;
        }

        return getConfig();
    }

    function getConfig() {
        return Object.freeze({
            baseUrl:
                getBaseUrl(),

            timeout:
                settings.timeout,

            retries:
                settings.retries,

            retryDelay:
                settings.retryDelay,

            maxRetryDelay:
                settings.maxRetryDelay,

            credentials:
                DEFAULT_CREDENTIALS,

            mode:
                DEFAULT_MODE
        });
    }

    /* ==========================================================================
       URL HELPERS
       ========================================================================== */

    function isAbsoluteUrl(value) {
        return (
            /^https?:\/\//i.test(
                value
            ) ||
            /^\/\//.test(value)
        );
    }

    function normalizeUrlPart(value) {
        return String(
            value || ""
        ).trim();
    }

    function joinUrl(
        baseUrl,
        path
    ) {
        const target =
            normalizeUrlPart(path);

        const base =
            normalizeUrlPart(baseUrl);

        if (!target) {
            return base;
        }

        /*
         * Absolute URLs bypass baseUrl.
         */
        if (
            isAbsoluteUrl(target)
        ) {
            return target;
        }

        /*
         * Relative URL without base.
         */
        if (!base) {
            return target;
        }

        return (
            base.replace(
                /\/+$/,
                ""
            ) +
            "/" +
            target.replace(
                /^\/+/,
                ""
            )
        );
    }

    /* ==========================================================================
       METHOD
       ========================================================================== */

    function normalizeMethod(method) {
        return String(
            method || "GET"
        )
            .trim()
            .toUpperCase();
    }

    /* ==========================================================================
       HEADERS
       ========================================================================== */

    function normalizeHeaders(
        headers
    ) {
        const result = {};

        if (!headers) {
            return result;
        }

        if (
            typeof Headers !==
                "undefined" &&
            headers instanceof Headers
        ) {
            headers.forEach(
                function (
                    value,
                    key
                ) {
                    result[key] =
                        value;
                }
            );

            return result;
        }

        if (
            isObject(headers)
        ) {
            Object.keys(
                headers
            ).forEach(
                function (key) {
                    const value =
                        headers[key];

                    if (
                        value !==
                            undefined &&
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
            String(
                name
            ).toLowerCase();

        return Object.keys(
            headers
        ).some(
            function (key) {
                return (
                    key.toLowerCase() ===
                    target
                );
            }
        );
    }

    function setHeaderIfMissing(
        headers,
        name,
        value
    ) {
        if (
            !hasHeader(
                headers,
                name
            )
        ) {
            headers[name] =
                value;
        }
    }

    /* ==========================================================================
       BODY HELPERS
       ========================================================================== */

    function isFormData(
        body
    ) {
        return (
            typeof FormData !==
                "undefined" &&
            body instanceof FormData
        );
    }

    function isBlob(
        body
    ) {
        return (
            typeof Blob !==
                "undefined" &&
            body instanceof Blob
        );
    }

    function isURLSearchParams(
        body
    ) {
        return (
            typeof URLSearchParams !==
                "undefined" &&
            body instanceof
                URLSearchParams
        );
    }

    function isArrayBuffer(
        body
    ) {
        return (
            typeof ArrayBuffer !==
                "undefined" &&
            body instanceof
                ArrayBuffer
        );
    }

    function isArrayBufferView(
        body
    ) {
        return (
            typeof ArrayBuffer !==
                "undefined" &&
            typeof ArrayBuffer.isView ===
                "function" &&
            ArrayBuffer.isView(
                body
            )
        );
    }

    function isBodyInstance(
        body
    ) {
        return (
            isFormData(body) ||
            isBlob(body) ||
            isURLSearchParams(body) ||
            isArrayBuffer(body) ||
            isArrayBufferView(body)
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

        /*
         * Never manually set multipart
         * Content-Type for FormData.
         *
         * The browser adds the correct
         * boundary automatically.
         */
        if (
            isFormData(body)
        ) {
            return body;
        }

        if (
            typeof body === "string" ||
            isBlob(body) ||
            isURLSearchParams(body) ||
            isArrayBuffer(body) ||
            isArrayBufferView(body)
        ) {
            return body;
        }

        if (
            isPlainObject(body) ||
            Array.isArray(body)
        ) {
            setHeaderIfMissing(
                headers,
                "Content-Type",
                "application/json"
            );

            return JSON.stringify(
                body
            );
        }

        return String(body);
    }

    /* ==========================================================================
       ABORT / TIMEOUT
       ========================================================================== */

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
                    externalSignal ||
                    undefined,

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

        if (
            externalSignal
        ) {
            if (
                externalSignal.aborted
            ) {
                externallyAborted =
                    true;

                controller.abort();
            } else if (
                typeof externalSignal
                    .addEventListener ===
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
                        typeof externalSignal
                            .removeEventListener ===
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

    /* ==========================================================================
       RESPONSE PARSING
       ========================================================================== */

    function isJsonContentType(
        contentType
    ) {
        const normalized =
            String(
                contentType || ""
            )
                .split(";")[0]
                .trim()
                .toLowerCase();

        return (
            JSON_CONTENT_TYPES.has(
                normalized
            ) ||
            normalized.endsWith(
                "+json"
            )
        );
    }

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
            isJsonContentType(
                contentType
            )
        ) {
            try {
                return JSON.parse(
                    text
                );
            } catch (error) {
                /*
                 * Keep the raw response if
                 * the server incorrectly labels
                 * invalid JSON as JSON.
                 */
                return text;
            }
        }

        return text;
    }

    /* ==========================================================================
       RETRY-AFTER
       ========================================================================== */

    function getRetryAfter(
        response
    ) {
        if (
            !response ||
            !response.headers
        ) {
            return null;
        }

        const value =
            response.headers.get(
                "Retry-After"
            );

        if (!value) {
            return null;
        }

        /*
         * Retry-After can be:
         *
         * 5
         *
         * or an HTTP date.
         */
        const seconds =
            Number(value);

        if (
            Number.isFinite(
                seconds
            ) &&
            seconds >= 0
        ) {
            return (
                seconds * 1000
            );
        }

        const timestamp =
            Date.parse(value);

        if (
            Number.isFinite(
                timestamp
            )
        ) {
            return Math.max(
                0,
                timestamp -
                    Date.now()
            );
        }

        return null;
    }

    /* ==========================================================================
       ERRORS
       ========================================================================== */

    function extractErrorMessage(
        data,
        fallback
    ) {
        if (
            data &&
            typeof data === "object" &&
            !Array.isArray(data)
        ) {
            return (
                data.message ||
                data.error ||
                data.detail ||
                fallback
            );
        }

        if (
            typeof data === "string" &&
            data.trim()
        ) {
            return data.trim();
        }

        return fallback;
    }

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

        const fallback =
            response.statusText ||
            "HTTP request failed.";

        const message =
            extractErrorMessage(
                data,
                fallback
            );

        const error =
            new Error(
                String(message)
            );

        error.name =
            "HttpError";

        error.status =
            response.status;

        error.statusText =
            response.statusText ||
            "";

        error.method =
            method;

        error.url =
            url;

        error.data =
            data;

        error.ok =
            false;

        error.retryable =
            RETRYABLE_STATUS_CODES.has(
                response.status
            );

        error.retryAfter =
            getRetryAfter(
                response
            );

        return error;
    }

    function createAbortError(
        message
    ) {
        let error;

        if (
            typeof DOMException !==
            "undefined"
        ) {
            error =
                new DOMException(
                    message,
                    "AbortError"
                );
        } else {
            error =
                new Error(
                    message
                );

            error.name =
                "AbortError";
        }

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
            typeof abortControl
                .externallyAborted ===
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

        if (
            timedOut
        ) {
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
            new Error(
                message
            );

        normalized.name =
            name;

        normalized.originalError =
            error;

        normalized.method =
            request.method;

        normalized.url =
            request.url;

        normalized.status =
            0;

        normalized.statusText =
            "";

        normalized.ok =
            false;

        normalized.timedOut =
            timedOut;

        normalized.aborted =
            externallyAborted;

        normalized.retryable =
            !timedOut &&
            !externallyAborted &&
            RETRYABLE_METHODS.has(
                request.method
            );

        return normalized;
    }

    /* ==========================================================================
       RETRY
       ========================================================================== */

    function calculateRetryDelay(
        request,
        attempt,
        response
    ) {
        const retryAfter =
            getRetryAfter(
                response
            );

        if (
            retryAfter !== null
        ) {
            return Math.min(
                retryAfter,
                request.maxRetryDelay
            );
        }

        const exponential =
            request.retryDelay *
            Math.pow(
                2,
                attempt
            );

        /*
         * Small jitter helps prevent
         * multiple clients retrying
         * at exactly the same time.
         */
        const jitter =
            Math.random() *
            Math.min(
                250,
                request.retryDelay
            );

        return Math.min(
            exponential + jitter,
            request.maxRetryDelay
        );
    }

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

    /* ==========================================================================
       WAIT
       ========================================================================== */

    function wait(
        milliseconds,
        signal
    ) {
        const delay =
            Math.max(
                0,
                Number(milliseconds) || 0
            );

        if (
            signal &&
            signal.aborted
        ) {
            return Promise.reject(
                createAbortError(
                    "The HTTP request was aborted."
                )
            );
        }

        if (
            delay === 0
        ) {
            return Promise.resolve();
        }

        return new Promise(
            function (
                resolve,
                reject
            ) {
                let timerId =
                    null;

                let abortHandler =
                    null;

                function cleanup() {
                    if (
                        timerId !== null
                    ) {
                        window.clearTimeout(
                            timerId
                        );

                        timerId =
                            null;
                    }

                    if (
                        signal &&
                        abortHandler &&
                        typeof signal
                            .removeEventListener ===
                            "function"
                    ) {
                        signal.removeEventListener(
                            "abort",
                            abortHandler
                        );

                        abortHandler =
                            null;
                    }
                }

                function abort() {
                    cleanup();

                    reject(
                        createAbortError(
                            "The HTTP request was aborted."
                        )
                    );
                }

                if (
                    signal &&
                    signal.aborted
                ) {
                    abort();

                    return;
                }

                if (
                    signal &&
                    typeof signal
                        .addEventListener ===
                        "function"
                ) {
                    abortHandler =
                        abort;

                    signal.addEventListener(
                        "abort",
                        abortHandler,
                        {
                            once: true
                        }
                    );
                }

                timerId =
                    window.setTimeout(
                        function () {
                            cleanup();

                            resolve();
                        },
                        delay
                    );
            }
        );
    }

    /* ==========================================================================
       REQUEST EXECUTION
       ========================================================================== */

    async function execute(
        requestOptions
    ) {
        for (
            let attempt = 0;
            attempt <=
            requestOptions.retries;
            attempt += 1
        ) {
            let abortControl =
                null;

            try {
                abortControl =
                    createAbortController(
                        requestOptions.timeout,
                        requestOptions.signal
                    );

                if (
                    abortControl.externallyAborted()
                ) {
                    throw createAbortError(
                        "The HTTP request was aborted."
                    );
                }

                const response =
                    await fetch(
                        requestOptions.url,
                        {
                            method:
                                requestOptions.method,

                            headers:
                                requestOptions.headers,

                            body:
                                requestOptions.body,

                            credentials:
                                requestOptions.credentials,

                            mode:
                                requestOptions.mode,

                            cache:
                                requestOptions.cache,

                            redirect:
                                requestOptions.redirect,

                            referrerPolicy:
                                requestOptions.referrerPolicy,

                            signal:
                                abortControl.signal
                        }
                    );

                if (
                    !response.ok
                ) {
                    if (
                        shouldRetry(
                            requestOptions.method,
                            response,
                            attempt,
                            requestOptions.retries
                        )
                    ) {
                        const delay =
                            calculateRetryDelay(
                                requestOptions,
                                attempt,
                                response
                            );

                        await wait(
                            delay,
                            requestOptions.signal
                        );

                        continue;
                    }

                    throw await createHttpError(
                        response,
                        requestOptions.url,
                        requestOptions.method
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
                        requestOptions.url,

                    method:
                        requestOptions.method,

                    attempts:
                        attempt + 1
                };
            } catch (error) {
                if (
                    error &&
                    error.name ===
                        "HttpError"
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
                 * Timeout and explicit cancellation
                 * are always terminal.
                 */
                if (
                    timedOut ||
                    externallyAborted ||
                    (
                        error &&
                        error.name ===
                            "AbortError"
                    )
                ) {
                    throw createNetworkError(
                        error,
                        requestOptions,
                        abortControl
                    );
                }

                /*
                 * Network failure.
                 *
                 * Only safe/idempotent methods
                 * may be automatically retried.
                 */
                if (
                    shouldRetry(
                        requestOptions.method,
                        null,
                        attempt,
                        requestOptions.retries
                    )
                ) {
                    const delay =
                        calculateRetryDelay(
                            requestOptions,
                            attempt,
                            null
                        );

                    try {
                        await wait(
                            delay,
                            requestOptions.signal
                        );
                    } catch (
                        retryError
                    ) {
                        throw createNetworkError(
                            retryError,
                            requestOptions,
                            abortControl
                        );
                    }

                    continue;
                }

                throw createNetworkError(
                    error,
                    requestOptions,
                    abortControl
                );
            } finally {
                if (
                    abortControl
                ) {
                    abortControl.cleanup();
                }
            }
        }

        throw new Error(
            "HTTP request failed."
        );
    }

    /* ==========================================================================
       PUBLIC REQUEST
       ========================================================================== */

    async function request(
        url,
        options
    ) {
        const value =
            isObject(options)
                ? options
                : {};

        const method =
            normalizeMethod(
                value.method
            );

        const configuredBaseUrl =
            value.baseUrl !==
            undefined
                ? String(
                      value.baseUrl ||
                          ""
                  ).trim()
                : "";

        const baseUrl =
            configuredBaseUrl ||
            settings.baseUrl ||
            resolveBaseUrl();

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

        /*
         * JSON is the normal API response
         * format. Accept both JSON and text.
         */
        setHeaderIfMissing(
            headers,
            "Accept",
            "application/json, text/plain, */*"
        );

        const timeout =
            Number.isFinite(
                value.timeout
            )
                ? Math.max(
                      0,
                      value.timeout
                  )
                : settings.timeout;

        const retries =
            Number.isInteger(
                value.retries
            )
                ? Math.max(
                      0,
                      value.retries
                  )
                : settings.retries;

        const retryDelay =
            Number.isFinite(
                value.retryDelay
            )
                ? Math.max(
                      0,
                      value.retryDelay
                  )
                : settings.retryDelay;

        const maxRetryDelay =
            Number.isFinite(
                value.maxRetryDelay
            )
                ? Math.max(
                      0,
                      value.maxRetryDelay
                  )
                : settings.maxRetryDelay;

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
                timeout,

            retries:
                retries,

            retryDelay:
                retryDelay,

            maxRetryDelay:
                maxRetryDelay,

            signal:
                value.signal ||
                null,

            credentials:
                value.credentials ||
                DEFAULT_CREDENTIALS,

            mode:
                value.mode ||
                DEFAULT_MODE,

            cache:
                value.cache ||
                DEFAULT_CACHE,

            redirect:
                value.redirect ||
                DEFAULT_REDIRECT,

            referrerPolicy:
                value.referrerPolicy ||
                DEFAULT_REFERRER_POLICY
        });
    }

    /* ==========================================================================
       HTTP METHODS
       ========================================================================== */

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
                    method:
                        "GET"
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
                    method:
                        "POST",

                    body:
                        body
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
                    method:
                        "PUT",

                    body:
                        body
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
                    method:
                        "PATCH",

                    body:
                        body
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
                    method:
                        "DELETE"
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
                    method:
                        "HEAD"
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
                    method:
                        "OPTIONS"
                }
            )
        );
    }

    /* ==========================================================================
       BASE URL
       ========================================================================== */

    function setBaseUrl(
        baseUrl
    ) {
        settings.baseUrl =
            typeof baseUrl ===
            "string"
                ? baseUrl.trim()
                : "";

        return getBaseUrl();
    }

    function getBaseUrl() {
        return (
            settings.baseUrl ||
            resolveBaseUrl()
        );
    }

    /* ==========================================================================
       PUBLIC API
       ========================================================================== */

    const Http =
        Object.freeze({
            request,

            get,
            post,
            put,
            patch,

            delete:
                remove,

            head,

            options:
                optionsRequest,

            configure,

            getConfig,

            setBaseUrl,

            getBaseUrl
        });

    /* ==========================================================================
       GLOBAL EXPORT
       ========================================================================== */

    CyberNexus.Http =
        Http;

    /*
     * Backward-compatible alias.
     *
     * Canonical API:
     *
     *     window.CyberNexus.Http
     */
    window.CyberNexusHttp =
        Http;

})(window);
