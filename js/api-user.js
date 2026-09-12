/* ==========================================================================
   CyberNexus IT Portfolio Platform
   File: frontend/js/api-user.js

   Responsibility:
   - Application API client
   - API prefix configuration
   - API path construction
   - HTTP method wrappers
   - Response data helpers

   Does NOT own:
   - Generic HTTP transport
   - Authentication
   - Account/profile operations
   - Application state
   - DOM/UI logic
   ========================================================================== */

(function (window) {
    "use strict";

    /* =======================================================
       NAMESPACE
    ======================================================= */

    const CyberNexus =
        (window.CyberNexus =
            window.CyberNexus || {});

    /* =======================================================
       DEPENDENCY
    ======================================================= */

    const Http =
        CyberNexus.Http ||
        window.CyberNexusHttp;

    if (
        !Http ||
        typeof Http.request !== "function"
    ) {
        throw new Error(
            "CyberNexus.Api requires CyberNexus.Http."
        );
    }

    /* =======================================================
       CONFIGURATION
    ======================================================= */

    const DEFAULT_PREFIX = "/api";

    const API = {
        prefix: DEFAULT_PREFIX
    };

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

    function resolveRuntimePrefix() {
        const config =
            getRuntimeConfig();

        const prefix =
            config.apiPrefix ||
            config.apiPath ||
            config.prefix;

        if (
            typeof prefix === "string"
        ) {
            return normalizePrefix(
                prefix
            );
        }

        return "";
    }

    function normalizePrefix(
        prefix
    ) {
        if (
            prefix === undefined ||
            prefix === null
        ) {
            return "";
        }

        const value =
            String(prefix).trim();

        if (!value) {
            return "";
        }

        if (
            /^https?:\/\//i.test(value) ||
            /^\/\//.test(value)
        ) {
            return value.replace(
                /\/+$/,
                ""
            );
        }

        return (
            "/" +
            value
                .replace(
                    /^\/+/,
                    ""
                )
                .replace(
                    /\/+$/,
                    ""
                )
        );
    }

    function configure(
        options
    ) {
        const value =
            options &&
            typeof options === "object" &&
            !Array.isArray(options)
                ? options
                : {};

        if (
            Object.prototype.hasOwnProperty.call(
                value,
                "prefix"
            )
        ) {
            API.prefix =
                normalizePrefix(
                    value.prefix
                );
        }

        return getConfig();
    }

    function getConfig() {
        const runtimePrefix =
            resolveRuntimePrefix();

        return Object.freeze({
            prefix:
                API.prefix ||
                runtimePrefix,

            baseUrl:
                typeof Http.getBaseUrl ===
                "function"
                    ? Http.getBaseUrl()
                    : ""
        });
    }

    /* =======================================================
       PATH BUILDING
    ======================================================= */

    function buildPath(
        path
    ) {
        const target =
            String(path || "").trim();

        const prefix =
            API.prefix ||
            resolveRuntimePrefix();

        if (!target) {
            return prefix || "";
        }

        /*
         * Absolute URLs are passed through unchanged.
         */
        if (
            /^https?:\/\//i.test(target) ||
            /^\/\//.test(target)
        ) {
            return target;
        }

        /*
         * If no API prefix is configured,
         * return the relative path unchanged.
         */
        if (!prefix) {
            return target;
        }

        /*
         * Avoid /api/api/... duplication.
         */
        if (
            target === prefix ||
            target.startsWith(
                prefix + "/"
            )
        ) {
            return target;
        }

        return (
            prefix.replace(
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

    /* =======================================================
       REQUEST
    ======================================================= */

    function request(
        path,
        options
    ) {
        return Http.request(
            buildPath(path),
            options
        );
    }

    /* =======================================================
       HTTP METHODS
    ======================================================= */

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

    function remove(
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

    /* =======================================================
       DATA HELPERS
    ======================================================= */

    async function getData(
        path,
        options
    ) {
        const response =
            await get(
                path,
                options
            );

        return response.data;
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

        return response.data;
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

        return response.data;
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

        return response.data;
    }

    async function deleteData(
        path,
        options
    ) {
        const response =
            await remove(
                path,
                options
            );

        return response.data;
    }

    /* =======================================================
       PUBLIC API
    ======================================================= */

    const Api =
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

            getData,
            postData,
            putData,
            patchData,
            deleteData,

            buildPath,

            configure,
            getConfig
        });

    /* =======================================================
       GLOBAL EXPORT
    ======================================================= */

    CyberNexus.Api =
        Api;

    window.CyberNexusApi =
        Api;

})(window);
