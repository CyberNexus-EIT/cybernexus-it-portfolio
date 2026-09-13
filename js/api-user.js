/*
 * CyberNexus IT Portfolio Platform
 * File: frontend/js/api-user.js
 *
 * Responsibility:
 * - Application API client
 * - API prefix configuration
 * - API path construction
 * - HTTP method wrappers
 * - Response data helpers
 * - Application endpoint definitions
 *
 * Does NOT own:
 * - Generic HTTP transport
 * - Authentication
 * - Account/profile operations
 * - Application state
 * - DOM/UI logic
 * - Chat/AI implementation
 * - Voice implementation
 */

(function (window) {
    "use strict";

    /* =========================================================
       NAMESPACE
       ========================================================= */

    const CyberNexus =
        (window.CyberNexus =
            window.CyberNexus || {});

    /* =========================================================
       DEPENDENCY
       ========================================================= */

    const Http =
        CyberNexus.Http ||
        window.CyberNexusHttp ||
        null;

    if (
        !Http ||
        typeof Http.request !== "function"
    ) {
        throw new Error(
            "CyberNexus.Api requires CyberNexus.Http."
        );
    }

    /* =========================================================
       CONSTANTS
       ========================================================= */

    const DEFAULT_API_PREFIX = "/api";

    const ENDPOINTS = Object.freeze({
        contact: "/contact",
        chat: "/chat"
    });

    /* =========================================================
       CONFIGURATION
       ========================================================= */

    /*
     * null means no explicit API prefix has
     * been configured.
     *
     * Resolution order:
     *
     * 1. Api.configure()
     * 2. Runtime application configuration
     * 3. /api
     */
    let configuredPrefix = null;

    /* =========================================================
       GENERAL HELPERS
       ========================================================= */

    function isObject(value) {
        return (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
        );
    }

    function hasOwn(
        object,
        property
    ) {
        return (
            object !== null &&
            object !== undefined &&
            Object.prototype.hasOwnProperty.call(
                object,
                property
            )
        );
    }

    function normalizeString(value) {
        if (
            value === undefined ||
            value === null
        ) {
            return "";
        }

        return String(value).trim();
    }

    function removeTrailingSlashes(value) {
        return String(value).replace(
            /\/+$/,
            ""
        );
    }

    function removeLeadingSlashes(value) {
        return String(value).replace(
            /^\/+/,
            ""
        );
    }

    function isAbsoluteUrl(value) {
        return (
            /^https?:\/\//i.test(value) ||
            /^\/\//.test(value)
        );
    }

    /* =========================================================
       RUNTIME CONFIGURATION
       ========================================================= */

    function getRuntimeConfig() {
        const globalConfig =
            window.__CYBERNEXUS_CONFIG__;

        if (
            isObject(globalConfig)
        ) {
            return globalConfig;
        }

        if (
            isObject(
                CyberNexus.Config
            )
        ) {
            return CyberNexus.Config;
        }

        return {};
    }

    function getRuntimePrefix() {
        const config =
            getRuntimeConfig();

        /*
         * apiBaseUrl is intentionally NOT used
         * as the API prefix.
         *
         * apiBaseUrl belongs to the HTTP layer.
         *
         * apiPrefix belongs to this API layer.
         */
        const prefix =
            config.apiPrefix ??
            config.apiPath ??
            config.prefix;

        return normalizePrefix(
            prefix
        );
    }

    /* =========================================================
       PREFIX NORMALIZATION
       ========================================================= */

    function normalizePrefix(prefix) {
        const value =
            normalizeString(prefix);

        if (!value) {
            return "";
        }

        /*
         * Absolute API URL.
         *
         * Example:
         *
         * https://api.example.com/api
         */
        if (
            isAbsoluteUrl(value)
        ) {
            return removeTrailingSlashes(
                value
            );
        }

        /*
         * Relative API path.
         *
         * Examples:
         *
         * api
         * /api
         * backend/api
         *
         * become:
         *
         * /api
         * /api
         * /backend/api
         */
        const clean =
            removeTrailingSlashes(
                removeLeadingSlashes(
                    value
                )
            );

        if (!clean) {
            return "";
        }

        return "/" + clean;
    }

    function getEffectivePrefix() {
        /*
         * Explicit configuration has priority.
         */
        if (
            configuredPrefix !== null
        ) {
            return configuredPrefix;
        }

        /*
         * Runtime application configuration.
         */
        const runtimePrefix =
            getRuntimePrefix();

        if (runtimePrefix) {
            return runtimePrefix;
        }

        /*
         * Safe application default.
         */
        return DEFAULT_API_PREFIX;
    }

    /* =========================================================
       CONFIGURATION API
       ========================================================= */

    function configure(options) {
        const config =
            isObject(options)
                ? options
                : {};

        /*
         * Prefer apiPrefix when both names
         * are supplied.
         */
        if (
            hasOwn(
                config,
                "apiPrefix"
            )
        ) {
            configuredPrefix =
                normalizePrefix(
                    config.apiPrefix
                );

            return getConfig();
        }

        if (
            hasOwn(
                config,
                "prefix"
            )
        ) {
            configuredPrefix =
                normalizePrefix(
                    config.prefix
                );
        }

        return getConfig();
    }

    function resetConfiguration() {
        configuredPrefix = null;

        return getConfig();
    }

    function getConfig() {
        const baseUrl =
            typeof Http.getBaseUrl ===
            "function"
                ? Http.getBaseUrl()
                : "";

        return Object.freeze({
            prefix:
                getEffectivePrefix(),

            baseUrl:
                normalizeString(
                    baseUrl
                )
        });
    }

    /* =========================================================
       URL HELPERS
       ========================================================= */

    function normalizePath(path) {
        return normalizeString(
            path
        );
    }

    function buildPath(path) {
        const target =
            normalizePath(
                path
            );

        const prefix =
            getEffectivePrefix();

        /*
         * No path.
         */
        if (!target) {
            return prefix;
        }

        /*
         * Already absolute.
         *
         * Example:
         *
         * https://example.com/test
         */
        if (
            isAbsoluteUrl(target)
        ) {
            return target;
        }

        /*
         * Explicitly configured empty prefix.
         */
        if (!prefix) {
            return target;
        }

        /*
         * Absolute API prefix.
         *
         * Example:
         *
         * prefix:
         * https://api.example.com/api
         *
         * path:
         * /contact
         *
         * result:
         * https://api.example.com/api/contact
         */
        if (
            isAbsoluteUrl(prefix)
        ) {
            return (
                removeTrailingSlashes(
                    prefix
                ) +
                "/" +
                removeLeadingSlashes(
                    target
                )
            );
        }

        const cleanPrefix =
            removeTrailingSlashes(
                prefix
            );

        const cleanTarget =
            removeLeadingSlashes(
                target
            );

        const prefixPath =
            removeLeadingSlashes(
                cleanPrefix
            );

        /*
         * Prevent:
         *
         * /api/api
         */
        if (
            cleanTarget ===
            prefixPath
        ) {
            return cleanPrefix;
        }

        /*
         * Prevent:
         *
         * /api/api/contact
         */
        if (
            cleanTarget.startsWith(
                prefixPath + "/"
            )
        ) {
            return "/" +
                cleanTarget;
        }

        return (
            cleanPrefix +
            "/" +
            cleanTarget
        );
    }

    /* =========================================================
       HTTP REQUEST
       ========================================================= */

    function request(
        path,
        options
    ) {
        return Http.request(
            buildPath(path),
            options
        );
    }

    /* =========================================================
       HTTP METHODS
       ========================================================= */

    function get(
        path,
        options
    ) {
        return Http.get(
            buildPath(path),
            options
        );
    }

    function post(
        path,
        body,
        options
    ) {
        return Http.post(
            buildPath(path),
            body,
            options
        );
    }

    function put(
        path,
        body,
        options
    ) {
        return Http.put(
            buildPath(path),
            body,
            options
        );
    }

    function patch(
        path,
        body,
        options
    ) {
        return Http.patch(
            buildPath(path),
            body,
            options
        );
    }

    function deleteRequest(
        path,
        options
    ) {
        return Http.delete(
            buildPath(path),
            options
        );
    }

    function head(
        path,
        options
    ) {
        return Http.head(
            buildPath(path),
            options
        );
    }

    function optionsRequest(
        path,
        options
    ) {
        return Http.options(
            buildPath(path),
            options
        );
    }

    /* =========================================================
       RESPONSE DATA HELPERS
       ========================================================= */

    async function getData(
        path,
        options
    ) {
        const response =
            await get(
                path,
                options
            );

        return extractResponseData(
            response
        );
    }

    async function postData(
        path,
        body,
        options
    ) {
        const response =
            await post(
                path,
                body,
                options
            );

        return extractResponseData(
            response
        );
    }

    async function putData(
        path,
        body,
        options
    ) {
        const response =
            await put(
                path,
                body,
                options
            );

        return extractResponseData(
            response
        );
    }

    async function patchData(
        path,
        body,
        options
    ) {
        const response =
            await patch(
                path,
                body,
                options
            );

        return extractResponseData(
            response
        );
    }

    async function deleteData(
        path,
        options
    ) {
        const response =
            await deleteRequest(
                path,
                options
            );

        return extractResponseData(
            response
        );
    }

    function extractResponseData(
        response
    ) {
        if (
            !response ||
            !hasOwn(
                response,
                "data"
            )
        ) {
            return null;
        }

        return response.data;
    }

    /* =========================================================
       APPLICATION ENDPOINTS
       ========================================================= */

    /*
     * Contact
     *
     * web-app.js
     *     ↓
     * Api.submitContact()
     *     ↓
     * Http.post()
     *     ↓
     * /api/contact
     */
    function submitContact(
        data,
        options
    ) {
        return post(
            ENDPOINTS.contact,
            data,
            options
        );
    }

    /*
     * Chat
     *
     * chat.js
     *     ↓
     * Api.sendChat()
     *     ↓
     * Http.post()
     *     ↓
     * /api/chat
     *
     * This keeps chat endpoint ownership
     * inside the API client.
     *
     * chat.js does NOT construct API URLs.
     */
    function sendChat(
        data,
        options
    ) {
        return post(
            ENDPOINTS.chat,
            data,
            options
        );
    }

    /* =========================================================
       ENDPOINT INFORMATION
       ========================================================= */

    function getEndpoints() {
        return Object.freeze({
            contact:
                buildPath(
                    ENDPOINTS.contact
                ),

            chat:
                buildPath(
                    ENDPOINTS.chat
                )
        });
    }

    /* =========================================================
       PUBLIC API
       ========================================================= */

    const Api =
        Object.freeze({

            /*
             * Configuration
             */
            configure,
            resetConfiguration,
            getConfig,

            /*
             * URL
             */
            buildPath,
            getEndpoints,

            /*
             * Generic request
             */
            request,

            /*
             * HTTP methods
             */
            get,
            post,
            put,
            patch,

            delete:
                deleteRequest,

            head,

            options:
                optionsRequest,

            /*
             * Response data helpers
             */
            getData,
            postData,
            putData,
            patchData,
            deleteData,

            /*
             * Application endpoints
             */
            submitContact,
            sendChat
        });

    /* =========================================================
       GLOBAL EXPORT
       ========================================================= */

    CyberNexus.Api =
        Api;

    /*
     * Compatibility alias.
     *
     * Canonical:
     *
     *     window.CyberNexus.Api
     *
     * Compatibility:
     *
     *     window.CyberNexusApi
     */
    window.CyberNexusApi =
        Api;

})(window);
