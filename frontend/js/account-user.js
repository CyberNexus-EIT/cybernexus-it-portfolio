/* ==========================================================================
   CyberNexus IT Portfolio Platform
   File: frontend/js/account-user.js

   Responsibility:
   - Account/profile operations
   - Profile updates
   - Account status
   - Account sessions
   - Account preferences
   - Cached account profile

   Does NOT own:
   - Generic HTTP transport
   - API path construction
   - Authentication/session identity
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
       DEPENDENCIES
    ======================================================= */

    const Api =
        CyberNexus.Api ||
        window.CyberNexusApi;

    const Auth =
        CyberNexus.Auth ||
        window.CyberNexusAuth;

    if (
        !Api ||
        typeof Api.get !== "function" ||
        typeof Api.post !== "function" ||
        typeof Api.put !== "function" ||
        typeof Api.delete !== "function"
    ) {
        throw new Error(
            "CyberNexus.Api must be loaded before account-user.js."
        );
    }

    if (
        !Auth ||
        typeof Auth.verifySession !== "function" ||
        typeof Auth.getUser !== "function" ||
        typeof Auth.isAuthenticated !== "function"
    ) {
        throw new Error(
            "CyberNexus.Auth must be loaded before account-user.js."
        );
    }

    /* =======================================================
       ACCOUNT STATE
    ======================================================= */

    const ACCOUNT = {
        profile: null,
        initialized: false
    };

    /* =======================================================
       NORMALIZATION
    ======================================================= */

    function normalizeObject(
        value
    ) {
        if (
            !value ||
            typeof value !== "object" ||
            Array.isArray(value)
        ) {
            return null;
        }

        return Object.assign(
            {},
            value
        );
    }

    function normalizeInput(
        value
    ) {
        if (
            !value ||
            typeof value !== "object" ||
            Array.isArray(value)
        ) {
            return {};
        }

        return value;
    }

    function extractProfile(
        response
    ) {
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

        return normalizeObject(
            data.profile ||
            data.account ||
            data.user ||
            null
        );
    }

    /* =======================================================
       PROFILE STATE
    ======================================================= */

    function setProfile(
        profile
    ) {
        ACCOUNT.profile =
            normalizeObject(
                profile
            );

        return ACCOUNT.profile;
    }

    function clearProfile() {
        ACCOUNT.profile =
            null;

        return null;
    }

    function getCachedProfile() {
        return ACCOUNT.profile;
    }

    /* =======================================================
       AUTHENTICATION HELPERS
    ======================================================= */

    function getCurrentUser() {
        return Auth.getUser();
    }

    function isAuthenticated() {
        return Auth.isAuthenticated();
    }

    async function requireAuthentication() {
        const authenticated =
            await Auth.verifySession();

        if (!authenticated) {
            clearProfile();

            throw new Error(
                "Authentication is required."
            );
        }

        return true;
    }

    /* =======================================================
       ACCOUNT
    ======================================================= */

    async function getAccount() {
        await requireAuthentication();

        const response =
            await Api.get(
                "/account"
            );

        const profile =
            extractProfile(
                response
            );

        if (
            profile &&
            response &&
            response.ok
        ) {
            setProfile(
                profile
            );
        }

        return response;
    }

    /* =======================================================
       PROFILE
    ======================================================= */

    async function getProfile() {
        await requireAuthentication();

        const response =
            await Api.get(
                "/account/profile"
            );

        const profile =
            extractProfile(
                response
            );

        if (
            profile &&
            response &&
            response.ok
        ) {
            setProfile(
                profile
            );
        }

        return response;
    }

    async function updateProfile(
        data
    ) {
        await requireAuthentication();

        const value =
            normalizeInput(
                data
            );

        const response =
            await Api.put(
                "/account/profile",
                value
            );

        const profile =
            extractProfile(
                response
            );

        if (
            profile &&
            response &&
            response.ok
        ) {
            setProfile(
                profile
            );
        }

        return response;
    }

    async function requestProfileUpdate(
        data
    ) {
        await requireAuthentication();

        const value =
            normalizeInput(
                data
            );

        return Api.post(
            "/account/profile/updates",
            value
        );
    }

    async function getProfileUpdates() {
        await requireAuthentication();

        return Api.get(
            "/account/profile/updates"
        );
    }

    /* =======================================================
       ACCOUNT STATUS
    ======================================================= */

    async function getAccountStatus() {
        await requireAuthentication();

        return Api.get(
            "/account/status"
        );
    }

    async function requestStatusChange(
        data
    ) {
        await requireAuthentication();

        const value =
            normalizeInput(
                data
            );

        return Api.post(
            "/account/status",
            value
        );
    }

    /* =======================================================
       SESSIONS
    ======================================================= */

    async function getSessions() {
        await requireAuthentication();

        return Api.get(
            "/account/sessions"
        );
    }

    async function revokeSession(
        sessionId
    ) {
        await requireAuthentication();

        const value =
            String(
                sessionId || ""
            ).trim();

        if (!value) {
            throw new Error(
                "Session ID is required."
            );
        }

        return Api.delete(
            "/account/sessions/" +
            encodeURIComponent(
                value
            )
        );
    }

    /* =======================================================
       PREFERENCES
    ======================================================= */

    async function getPreferences() {
        await requireAuthentication();

        return Api.get(
            "/account/preferences"
        );
    }

    async function updatePreferences(
        data
    ) {
        await requireAuthentication();

        const value =
            normalizeInput(
                data
            );

        return Api.put(
            "/account/preferences",
            value
        );
    }

    /* =======================================================
       INITIALIZATION
    ======================================================= */

    async function initialize() {
        if (
            ACCOUNT.initialized
        ) {
            return getCachedProfile();
        }

        ACCOUNT.initialized =
            true;

        /*
         * A cached authentication user is not sufficient
         * to authorize account operations.
         *
         * Verify the backend session before loading
         * account information.
         */
        try {
            await getAccount();

            return getCachedProfile();
        } catch (error) {
            clearProfile();

            return null;
        }
    }

    /* =======================================================
       PUBLIC API
    ======================================================= */

    const Account =
        Object.freeze({
            initialize,

            getAccount,

            getProfile,

            updateProfile,

            requestProfileUpdate,

            getProfileUpdates,

            getAccountStatus,

            requestStatusChange,

            getSessions,

            revokeSession,

            getPreferences,

            updatePreferences,

            setProfile,

            clearProfile,

            getCachedProfile,

            getCurrentUser,

            isAuthenticated
        });

    /* =======================================================
       GLOBAL EXPORT
    ======================================================= */

    CyberNexus.Account =
        Account;

    window.CyberNexusAccount =
        Account;

})(window);
