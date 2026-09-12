/* ==========================================================================
   CyberNexus IT Portfolio Platform
   File: frontend/js/auth-user.js

   Responsibility:
   - Authentication state
   - Login and logout
   - Session retrieval and verification
   - Registration
   - Password reset/change requests
   - Local authentication-user persistence as a UI cache

   Does NOT own:
   - Generic HTTP transport
   - API path construction
   - Account/profile management
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

    const Api =
        CyberNexus.Api ||
        window.CyberNexusApi;

    if (
        !Api ||
        typeof Api.post !== "function" ||
        typeof Api.get !== "function"
    ) {
        throw new Error(
            "CyberNexus.Api must be loaded before auth-user.js."
        );
    }

    /* =======================================================
       CONSTANTS
    ======================================================= */

    const STORAGE_KEY =
        "cybernexus-auth-user";

    /* =======================================================
       AUTHENTICATION STATE
    ======================================================= */

    const AUTH = {
        currentUser: null,
        authenticated: false,
        initialized: false
    };

    /* =======================================================
       USER NORMALIZATION
    ======================================================= */

    function normalizeUser(user) {
        if (
            !user ||
            typeof user !== "object" ||
            Array.isArray(user)
        ) {
            return null;
        }

        return Object.assign(
            {},
            user
        );
    }

    function extractUser(response) {
        const data =
            response &&
            response.data;

        if (
            !data ||
            typeof data !== "object" ||
            Array.isArray(data)
        ) {
            return null;
        }

        return normalizeUser(
            data.user || null
        );
    }

    /* =======================================================
       STATE
    ======================================================= */

    function setUser(user) {
        const normalized =
            normalizeUser(user);

        AUTH.currentUser =
            normalized;

        AUTH.authenticated =
            Boolean(normalized);

        return AUTH.currentUser;
    }

    function clearUser() {
        AUTH.currentUser =
            null;

        AUTH.authenticated =
            false;

        return null;
    }

    function getUser() {
        return AUTH.currentUser;
    }

    function isAuthenticated() {
        return AUTH.authenticated;
    }

    /* =======================================================
       LOCAL STORAGE
       UI CACHE ONLY — NOT AUTHORITY
    ======================================================= */

    function canUseStorage() {
        try {
            if (
                !window.localStorage
            ) {
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

            return true;
        } catch (error) {
            return false;
        }
    }

    function getStoredUser() {
        if (!canUseStorage()) {
            return null;
        }

        try {
            const value =
                window.localStorage.getItem(
                    STORAGE_KEY
                );

            if (!value) {
                return null;
            }

            return normalizeUser(
                JSON.parse(value)
            );
        } catch (error) {
            return null;
        }
    }

    function storeUser(user) {
        if (!canUseStorage()) {
            return false;
        }

        try {
            if (!user) {
                window.localStorage.removeItem(
                    STORAGE_KEY
                );

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

            return true;
        } catch (error) {
            return false;
        }
    }

    function restoreUser() {
        const user =
            getStoredUser();

        if (user) {
            /*
             * The stored user is display/cache data only.
             * It does not prove an active authenticated session.
             */
            AUTH.currentUser =
                user;

            AUTH.authenticated =
                false;
        } else {
            clearUser();
        }

        AUTH.initialized =
            true;

        return getUser();
    }

    /* =======================================================
       LOGIN
    ======================================================= */

    async function login(
        credentials
    ) {
        const value =
            credentials &&
            typeof credentials === "object" &&
            !Array.isArray(credentials)
                ? credentials
                : {};

        const response =
            await Api.post(
                "/auth/login",
                value
            );

        const user =
            extractUser(response);

        if (
            response &&
            response.ok &&
            user
        ) {
            setUser(user);
            storeUser(user);
        } else {
            clearUser();
            storeUser(null);
        }

        return response;
    }

    /* =======================================================
       LOGOUT
    ======================================================= */

    async function logout() {
        let response = null;

        try {
            response =
                await Api.post(
                    "/auth/logout",
                    {}
                );
        } finally {
            /*
             * Always clear the local authentication state,
             * even if the backend request fails.
             */
            clearUser();
            storeUser(null);
        }

        return response;
    }

    /* =======================================================
       SESSION
    ======================================================= */

    async function getSession() {
        const response =
            await Api.get(
                "/auth/session"
            );

        const user =
            extractUser(response);

        if (
            response &&
            response.ok &&
            user
        ) {
            setUser(user);
            storeUser(user);
        } else {
            clearUser();
            storeUser(null);
        }

        return response;
    }

    async function refreshSession() {
        return getSession();
    }

    async function verifySession() {
        try {
            const response =
                await getSession();

            return Boolean(
                response &&
                response.ok &&
                AUTH.authenticated
            );
        } catch (error) {
            clearUser();
            storeUser(null);

            return false;
        }
    }

    /* =======================================================
       REGISTRATION
    ======================================================= */

    async function register(
        data
    ) {
        return Api.post(
            "/auth/register",
            data || {}
        );
    }

    /* =======================================================
       PASSWORD RESET
    ======================================================= */

    async function requestPasswordReset(
        data
    ) {
        return Api.post(
            "/auth/password-reset",
            data || {}
        );
    }

    async function verifyPasswordReset(
        data
    ) {
        return Api.post(
            "/auth/password-reset/verify",
            data || {}
        );
    }

    async function resetPassword(
        data
    ) {
        return Api.post(
            "/auth/password-reset/complete",
            data || {}
        );
    }

    /* =======================================================
       PASSWORD CHANGE
    ======================================================= */

    async function changePassword(
        data
    ) {
        return Api.post(
            "/auth/password-change",
            data || {}
        );
    }

    /* =======================================================
       INITIALIZATION
    ======================================================= */

    function initialize() {
        if (
            !AUTH.initialized
        ) {
            restoreUser();
        }

        return AUTH.initialized;
    }

    /* =======================================================
       PUBLIC API
    ======================================================= */

    const Auth =
        Object.freeze({
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

            setUser,
            clearUser,
            getUser,
            isAuthenticated,

            getStoredUser,
            storeUser
        });

    /* =======================================================
       GLOBAL EXPORT
    ======================================================= */

    CyberNexus.Auth =
        Auth;

    window.CyberNexusAuth =
        Auth;

})(window);
