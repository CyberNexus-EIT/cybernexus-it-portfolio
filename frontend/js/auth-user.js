/*
 * CyberNexus IT Portfolio Platform
 * File: frontend/js/auth-user.js
 *
 * Responsibility:
 * - Authentication state
 * - Login and logout
 * - Session retrieval and verification
 * - Registration
 * - Password reset/change requests
 * - Safe local authentication-user UI cache
 * - Authentication state subscriptions
 *
 * Does NOT own:
 * - Generic HTTP transport
 * - API path construction
 * - Account/profile management
 * - Application state
 * - DOM/UI logic
 * - Chat/AI operations
 * - Voice operations
 *
 * Security rule:
 * - Backend session is the authentication authority.
 * - localStorage is UI cache only.
 * - Authentication tokens/passwords are never stored here.
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
       DEPENDENCY
       ======================================================= */

    const Api =
        CyberNexus.Api ||
        window.CyberNexusApi ||
        null;

    if (
        !Api ||
        typeof Api.post !== "function" ||
        typeof Api.get !== "function"
    ) {
        throw new Error(
            "CyberNexus.Auth requires CyberNexus.Api."
        );
    }

    /* =======================================================
       CONSTANTS
       ======================================================= */

    const STORAGE_KEY =
        "cybernexus-auth-user";

    const AUTH_STATE = Object.freeze({
        UNKNOWN: "unknown",
        AUTHENTICATED: "authenticated",
        UNAUTHENTICATED: "unauthenticated"
    });

    const ENDPOINTS = Object.freeze({
        login: "/auth/login",
        logout: "/auth/logout",
        session: "/auth/session",
        register: "/auth/register",
        passwordReset:
            "/auth/password-reset",
        passwordResetVerify:
            "/auth/password-reset/verify",
        passwordResetComplete:
            "/auth/password-reset/complete",
        passwordChange:
            "/auth/password-change"
    });

    /*
     * Only non-sensitive identity information
     * is allowed in the local UI cache.
     *
     * Never cache:
     * - password
     * - access token
     * - refresh token
     * - session token
     * - cookies
     * - authorization headers
     * - secrets
     */
    const CACHE_FIELDS = Object.freeze([
        "id",
        "userId",
        "username",
        "email",
        "name",
        "displayName",
        "role",
        "status"
    ]);

    /* =======================================================
       AUTHENTICATION STATE
       ======================================================= */

    const AUTH = {
        currentUser: null,
        cachedUser: null,
        state: AUTH_STATE.UNKNOWN,
        initialized: false
    };

    const subscribers = new Set();

    let storageAvailable = null;

    /* =======================================================
       GENERAL HELPERS
       ======================================================= */

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
        return Object.prototype.hasOwnProperty.call(
            object,
            property
        );
    }

    function normalizeString(
        value
    ) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    function clone(value) {
        if (value === undefined) {
            return undefined;
        }

        try {
            return JSON.parse(
                JSON.stringify(value)
            );
        } catch (error) {
            return undefined;
        }
    }

    function valuesEqual(
        first,
        second
    ) {
        try {
            return (
                JSON.stringify(first) ===
                JSON.stringify(second)
            );
        } catch (error) {
            return first === second;
        }
    }

    /* =======================================================
       USER CACHE NORMALIZATION
       ======================================================= */

    function normalizeUser(
        user
    ) {
        if (
            !isObject(user)
        ) {
            return null;
        }

        const normalized = {};

        CACHE_FIELDS.forEach(
            function (field) {
                if (
                    !hasOwn(
                        user,
                        field
                    )
                ) {
                    return;
                }

                const value =
                    user[field];

                if (
                    value === null ||
                    value === undefined
                ) {
                    return;
                }

                if (
                    typeof value ===
                    "string"
                ) {
                    const text =
                        value.trim();

                    if (text) {
                        normalized[field] =
                            text;
                    }

                    return;
                }

                if (
                    typeof value ===
                        "number" ||
                    typeof value ===
                        "boolean"
                ) {
                    normalized[field] =
                        value;
                }
            }
        );

        return Object.keys(
            normalized
        ).length
            ? normalized
            : null;
    }

    /* =======================================================
       RESPONSE USER EXTRACTION
       ======================================================= */

    function extractUser(
        response
    ) {
        const data =
            response &&
            response.data;

        if (
            !isObject(data)
        ) {
            return null;
        }

        /*
         * Preferred API response:
         *
         * {
         *     user: {...}
         * }
         */
        if (
            isObject(
                data.user
            )
        ) {
            return normalizeUser(
                data.user
            );
        }

        /*
         * Alternative:
         *
         * {
         *     data: {
         *         user: {...}
         *     }
         * }
         */
        if (
            isObject(
                data.data
            ) &&
            isObject(
                data.data.user
            )
        ) {
            return normalizeUser(
                data.data.user
            );
        }

        /*
         * Direct user response.
         */
        if (
            hasOwn(data, "id") ||
            hasOwn(data, "userId") ||
            hasOwn(data, "username") ||
            hasOwn(data, "email")
        ) {
            return normalizeUser(
                data
            );
        }

        return null;
    }

    /* =======================================================
       RESPONSE SUCCESS
       ======================================================= */

    function isSuccessfulResponse(
        response
    ) {
        if (
            !response ||
            typeof response !==
                "object"
        ) {
            return false;
        }

        /*
         * http-user.js normally exposes
         * response.ok.
         */
        if (
            typeof response.ok ===
            "boolean"
        ) {
            return response.ok;
        }

        /*
         * Fallback for API responses
         * without an HTTP wrapper.
         */
        if (
            isObject(
                response.data
            ) &&
            typeof response.data
                .success ===
                "boolean"
        ) {
            return response.data.success;
        }

        return false;
    }

    /* =======================================================
       ERROR HELPERS
       ======================================================= */

    function getErrorStatus(
        error
    ) {
        if (!error) {
            return null;
        }

        if (
            typeof error.status ===
            "number"
        ) {
            return error.status;
        }

        if (
            error.response &&
            typeof error.response.status ===
                "number"
        ) {
            return error.response.status;
        }

        if (
            error.data &&
            typeof error.data.status ===
                "number"
        ) {
            return error.data.status;
        }

        return null;
    }

    function isUnauthorizedError(
        error
    ) {
        const status =
            getErrorStatus(error);

        return (
            status === 401 ||
            status === 403
        );
    }

    /* =======================================================
       AUTH STATE
       ======================================================= */

    function notify(
        reason
    ) {
        const snapshot =
            getAuthSnapshot();

        subscribers.forEach(
            function (listener) {
                try {
                    listener(
                        clone(snapshot),
                        reason
                    );
                } catch (error) {
                    console.error(
                        "[CyberNexus Auth] Subscriber error:",
                        error
                    );
                }
            }
        );
    }

    function setAuthenticatedUser(
        user,
        reason
    ) {
        const normalized =
            normalizeUser(user);

        const previousState =
            AUTH.state;

        const previousUser =
            AUTH.currentUser;

        if (!normalized) {
            clearAuthenticatedUser(
                reason
            );

            return null;
        }

        AUTH.currentUser =
            normalized;

        AUTH.state =
            AUTH_STATE.AUTHENTICATED;

        if (
            previousState !==
                AUTH.state ||
            !valuesEqual(
                previousUser,
                normalized
            )
        ) {
            notify(
                reason ||
                    "authenticated"
            );
        }

        return clone(
            AUTH.currentUser
        );
    }

    function clearAuthenticatedUser(
        reason
    ) {
        const changed =
            AUTH.currentUser !==
                null ||
            AUTH.state !==
                AUTH_STATE.UNAUTHENTICATED;

        AUTH.currentUser =
            null;

        AUTH.state =
            AUTH_STATE.UNAUTHENTICATED;

        if (changed) {
            notify(
                reason ||
                    "unauthenticated"
            );
        }

        return null;
    }

    function markUnknown(
        reason
    ) {
        const changed =
            AUTH.currentUser !==
                null ||
            AUTH.state !==
                AUTH_STATE.UNKNOWN;

        AUTH.currentUser =
            null;

        AUTH.state =
            AUTH_STATE.UNKNOWN;

        if (changed) {
            notify(
                reason ||
                    "authentication-unknown"
            );
        }

        return AUTH.state;
    }

    function getUser() {
        return clone(
            AUTH.currentUser
        );
    }

    function getCachedUser() {
        return clone(
            AUTH.cachedUser
        );
    }

    function getState() {
        return AUTH.state;
    }

    function isAuthenticated() {
        /*
         * Only a backend-verified user
         * can make this true.
         *
         * cachedUser never affects this.
         */
        return (
            AUTH.state ===
            AUTH_STATE.AUTHENTICATED
        );
    }

    function isInitialized() {
        return Boolean(
            AUTH.initialized
        );
    }

    function getAuthSnapshot() {
        return {
            state:
                AUTH.state,

            authenticated:
                isAuthenticated(),

            initialized:
                AUTH.initialized,

            user:
                clone(
                    AUTH.currentUser
                ),

            cachedUser:
                clone(
                    AUTH.cachedUser
                )
        };
    }

    /* =======================================================
       LOCAL STORAGE
       UI CACHE ONLY
       ======================================================= */

    function canUseStorage() {
        if (
            storageAvailable !==
            null
        ) {
            return storageAvailable;
        }

        try {
            if (
                !window.localStorage
            ) {
                storageAvailable =
                    false;

                return false;
            }

            const testKey =
                "__cybernexus_auth_test__";

            window.localStorage.setItem(
                testKey,
                "1"
            );

            window.localStorage.removeItem(
                testKey
            );

            storageAvailable =
                true;

            return true;
        } catch (error) {
            storageAvailable =
                false;

            return false;
        }
    }

    function invalidateStorage() {
        storageAvailable =
            null;
    }

    function getStoredUser() {
        if (
            !canUseStorage()
        ) {
            return null;
        }

        try {
            const raw =
                window.localStorage.getItem(
                    STORAGE_KEY
                );

            if (!raw) {
                return null;
            }

            const parsed =
                JSON.parse(raw);

            return normalizeUser(
                parsed
            );
        } catch (error) {
            /*
             * Remove corrupted cache,
             * but do not affect backend
             * authentication state.
             */
            try {
                window.localStorage.removeItem(
                    STORAGE_KEY
                );
            } catch (removeError) {
                invalidateStorage();
            }

            return null;
        }
    }

    function storeUser(
        user
    ) {
        if (
            !canUseStorage()
        ) {
            return false;
        }

        try {
            if (!user) {
                window.localStorage.removeItem(
                    STORAGE_KEY
                );

                AUTH.cachedUser =
                    null;

                return true;
            }

            const normalized =
                normalizeUser(user);

            if (!normalized) {
                return false;
            }

            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(
                    normalized
                )
            );

            AUTH.cachedUser =
                normalized;

            return true;
        } catch (error) {
            invalidateStorage();

            console.warn(
                "[CyberNexus Auth] Unable to store UI cache:",
                error
            );

            return false;
        }
    }

    function clearStoredUser() {
        if (
            !canUseStorage()
        ) {
            AUTH.cachedUser =
                null;

            return false;
        }

        try {
            window.localStorage.removeItem(
                STORAGE_KEY
            );

            AUTH.cachedUser =
                null;

            return true;
        } catch (error) {
            invalidateStorage();

            AUTH.cachedUser =
                null;

            return false;
        }
    }

    function restoreUser() {
        const cached =
            getStoredUser();

        AUTH.cachedUser =
            cached;

        /*
         * Cached identity is deliberately
         * NOT assigned to currentUser.
         *
         * The backend must verify the
         * current session first.
         */
        AUTH.currentUser =
            null;

        AUTH.state =
            AUTH_STATE.UNKNOWN;

        AUTH.initialized =
            true;

        notify(
            "cache-restored"
        );

        return getCachedUser();
    }

    /* =======================================================
       LOGIN
       ======================================================= */

    async function login(
        credentials
    ) {
        const value =
            isObject(
                credentials
            )
                ? credentials
                : {};

        /*
         * Never allow a previous
         * authenticated state to remain
         * during a new login attempt.
         */
        markUnknown(
            "login-started"
        );

        try {
            const response =
                await Api.post(
                    ENDPOINTS.login,
                    value
                );

            const user =
                extractUser(
                    response
                );

            if (
                isSuccessfulResponse(
                    response
                ) &&
                user
            ) {
                setAuthenticatedUser(
                    user,
                    "login-success"
                );

                storeUser(
                    user
                );

                AUTH.initialized =
                    true;

                return response;
            }

            /*
             * A completed login response
             * without a valid authenticated
             * user is treated as failure.
             */
            clearAuthenticatedUser(
                "login-failed"
            );

            clearStoredUser();

            AUTH.initialized =
                true;

            return response;
        } catch (error) {
            clearAuthenticatedUser(
                "login-error"
            );

            clearStoredUser();

            AUTH.initialized =
                true;

            throw error;
        }
    }

    /* =======================================================
       LOGOUT
       ======================================================= */

    async function logout() {
        let response =
            null;

        try {
            response =
                await Api.post(
                    ENDPOINTS.logout,
                    {}
                );

            return response;
        } finally {
            /*
             * Logout is locally authoritative:
             * even if the network request fails,
             * the frontend must not continue
             * treating the user as authenticated.
             */
            clearAuthenticatedUser(
                "logout"
            );

            clearStoredUser();

            AUTH.initialized =
                true;
        }
    }

    /* =======================================================
       SESSION
       ======================================================= */

    async function getSession() {
        markUnknown(
            "session-check-started"
        );

        try {
            const response =
                await Api.get(
                    ENDPOINTS.session
                );

            const user =
                extractUser(
                    response
                );

            if (
                isSuccessfulResponse(
                    response
                ) &&
                user
            ) {
                setAuthenticatedUser(
                    user,
                    "session-authenticated"
                );

                storeUser(
                    user
                );

                AUTH.initialized =
                    true;

                return response;
            }

            /*
             * Backend explicitly says that
             * there is no authenticated session.
             */
            clearAuthenticatedUser(
                "session-unauthenticated"
            );

            clearStoredUser();

            AUTH.initialized =
                true;

            return response;
        } catch (error) {
            /*
             * A 401/403 means the backend
             * rejected the session.
             *
             * A network/server error does NOT
             * prove that the session is invalid.
             */
            if (
                isUnauthorizedError(
                    error
                )
            ) {
                clearAuthenticatedUser(
                    "session-expired"
                );

                clearStoredUser();
            } else {
                /*
                 * Security-first behavior:
                 * authentication remains UNKNOWN.
                 *
                 * Keep the cached identity for
                 * UI purposes, but it cannot make
                 * isAuthenticated() true.
                 */
                markUnknown(
                    "session-unavailable"
                );
            }

            AUTH.initialized =
                true;

            throw error;
        }
    }

    async function refreshSession() {
        return getSession();
    }

    async function verifySession() {
        try {
            const response =
                await getSession();

            return Boolean(
                isSuccessfulResponse(
                    response
                ) &&
                isAuthenticated()
            );
        } catch (error) {
            /*
             * Do not claim authentication
             * when verification failed.
             */
            return false;
        }
    }

    /* =======================================================
       REGISTRATION
       ======================================================= */

    async function register(
        data
    ) {
        const value =
            isObject(data)
                ? data
                : {};

        return Api.post(
            ENDPOINTS.register,
            value
        );
    }

    /* =======================================================
       PASSWORD RESET
       ======================================================= */

    async function requestPasswordReset(
        data
    ) {
        const value =
            isObject(data)
                ? data
                : {};

        return Api.post(
            ENDPOINTS.passwordReset,
            value
        );
    }

    async function verifyPasswordReset(
        data
    ) {
        const value =
            isObject(data)
                ? data
                : {};

        return Api.post(
            ENDPOINTS.passwordResetVerify,
            value
        );
    }

    async function resetPassword(
        data
    ) {
        const value =
            isObject(data)
                ? data
                : {};

        return Api.post(
            ENDPOINTS.passwordResetComplete,
            value
        );
    }

    /* =======================================================
       PASSWORD CHANGE
       ======================================================= */

    async function changePassword(
        data
    ) {
        const value =
            isObject(data)
                ? data
                : {};

        return Api.post(
            ENDPOINTS.passwordChange,
            value
        );
    }

    /* =======================================================
       INITIALIZATION
       ======================================================= */

    function initialize() {
        if (
            AUTH.initialized
        ) {
            return AUTH.initialized;
        }

        restoreUser();

        return AUTH.initialized;
    }

    /* =======================================================
       SUBSCRIPTIONS
       ======================================================= */

    function subscribe(
        listener
    ) {
        if (
            typeof listener !==
            "function"
        ) {
            return function () {};
        }

        subscribers.add(
            listener
        );

        return function unsubscribe() {
            subscribers.delete(
                listener
            );
        };
    }

    function unsubscribe(
        listener
    ) {
        if (
            typeof listener !==
            "function"
        ) {
            return false;
        }

        return subscribers.delete(
            listener
        );
    }

    function clearSubscribers() {
        subscribers.clear();
    }

    /* =======================================================
       PUBLIC API
       ======================================================= */

    const Auth =
        Object.freeze({
            constants:
                Object.freeze({
                    STORAGE_KEY,
                    AUTH_STATE,
                    ENDPOINTS,
                    CACHE_FIELDS
                }),

            initialize,

            login,
            logout,

            getSession,
            refreshSession,
            verifySession,

            register,

            requestPasswordReset,
            verifyPasswordReset,
            resetPassword,
            changePassword,

            getUser,
            getCachedUser,
            getAuthSnapshot,

            getState,
            isAuthenticated,
            isInitialized,

            setUser:
                setAuthenticatedUser,

            clearUser:
                clearAuthenticatedUser,

            getStoredUser,
            storeUser,
            clearStoredUser,

            subscribe,
            unsubscribe,
            clearSubscribers
        });

    /* =======================================================
       GLOBAL EXPORT
       ======================================================= */

    CyberNexus.Auth =
        Auth;

    /*
     * Backward-compatible global alias.
     *
     * Canonical:
     *
     *     window.CyberNexus.Auth
     *
     * Compatibility:
     *
     *     window.CyberNexusAuth
     */
    window.CyberNexusAuth =
        Auth;

})(window);
