/*
 * CyberNexus IT Portfolio Platform
 * File: frontend/js/account-user.js
 *
 * Responsibility:
 * - Account/profile operations
 * - Profile updates
 * - Account status
 * - Account sessions
 * - Account preferences
 * - Cached account profile
 * - Account state subscriptions
 *
 * Does NOT own:
 * - Generic HTTP transport
 * - API path construction
 * - Authentication/session identity
 * - Application state
 * - DOM/UI logic
 * - Login/logout
 * - Password operations
 *
 * Security rule:
 * - Auth is authoritative.
 * - Account data is only loaded after backend
 *   authentication has been verified.
 * - Cached profile data never proves authentication.
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
       DEPENDENCIES
       ======================================================= */

    const Api =
        CyberNexus.Api ||
        window.CyberNexusApi ||
        null;

    const Auth =
        CyberNexus.Auth ||
        window.CyberNexusAuth ||
        null;

    if (
        !Api ||
        typeof Api.get !== "function" ||
        typeof Api.post !== "function" ||
        typeof Api.put !== "function" ||
        typeof Api.delete !== "function"
    ) {
        throw new Error(
            "CyberNexus.Account requires CyberNexus.Api."
        );
    }

    if (
        !Auth ||
        typeof Auth.verifySession !==
            "function" ||
        typeof Auth.getUser !==
            "function" ||
        typeof Auth.isAuthenticated !==
            "function"
    ) {
        throw new Error(
            "CyberNexus.Account requires CyberNexus.Auth."
        );
    }

    /* =======================================================
       CONSTANTS
       ======================================================= */

    const ENDPOINTS = Object.freeze({
        account: "/account",

        profile:
            "/account/profile",

        profileUpdates:
            "/account/profile/updates",

        status:
            "/account/status",

        sessions:
            "/account/sessions",

        preferences:
            "/account/preferences"
    });

    const ACCOUNT_STATE = Object.freeze({
        UNKNOWN: "unknown",
        LOADING: "loading",
        READY: "ready",
        UNAUTHENTICATED:
            "unauthenticated",
        ERROR: "error"
    });

    /* =======================================================
       ACCOUNT STATE
       ======================================================= */

    const ACCOUNT = {
        profile: null,

        state:
            ACCOUNT_STATE.UNKNOWN,

        initialized: false,

        loading: false,

        error: null,

        ownerKey: null
    };

    const subscribers = new Set();

    let initializationPromise =
        null;

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

    function normalizeObject(value) {
        if (!isObject(value)) {
            return null;
        }

        return Object.assign(
            {},
            value
        );
    }

    function normalizeInput(value) {
        if (!isObject(value)) {
            return {};
        }

        return Object.assign(
            {},
            value
        );
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

    function normalizeId(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    /* =======================================================
       RESPONSE HELPERS
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

        if (
            typeof response.ok ===
            "boolean"
        ) {
            return response.ok;
        }

        const data =
            response.data;

        if (
            isObject(data) &&
            typeof data.success ===
                "boolean"
        ) {
            return data.success;
        }

        return false;
    }

    function extractData(
        response
    ) {
        if (
            !response ||
            !isObject(
                response.data
            )
        ) {
            return null;
        }

        return response.data;
    }

    function extractProfile(
        response
    ) {
        const data =
            extractData(
                response
            );

        if (!data) {
            return null;
        }

        /*
         * Supported:
         *
         * {
         *     profile: {...}
         * }
         *
         * {
         *     account: {...}
         * }
         *
         * {
         *     user: {...}
         * }
         *
         * {
         *     data: {
         *         profile: {...}
         *     }
         * }
         */

        if (
            isObject(
                data.profile
            )
        ) {
            return normalizeObject(
                data.profile
            );
        }

        if (
            isObject(
                data.account
            )
        ) {
            return normalizeObject(
                data.account
            );
        }

        if (
            isObject(
                data.user
            )
        ) {
            return normalizeObject(
                data.user
            );
        }

        if (
            isObject(
                data.data
            )
        ) {
            if (
                isObject(
                    data.data.profile
                )
            ) {
                return normalizeObject(
                    data.data.profile
                );
            }

            if (
                isObject(
                    data.data.account
                )
            ) {
                return normalizeObject(
                    data.data.account
                );
            }

            if (
                isObject(
                    data.data.user
                )
            ) {
                return normalizeObject(
                    data.data.user
                );
            }
        }

        return null;
    }

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
       OWNER IDENTITY
       ======================================================= */

    function getCurrentUser() {
        return Auth.getUser();
    }

    function getOwnerKey(
        user
    ) {
        if (!user) {
            return "";
        }

        const id =
            normalizeId(
                user.id
            );

        if (id) {
            return "id:" + id;
        }

        const userId =
            normalizeId(
                user.userId
            );

        if (userId) {
            return "userId:" +
                userId;
        }

        const username =
            normalizeId(
                user.username
            );

        if (username) {
            return "username:" +
                username;
        }

        const email =
            normalizeId(
                user.email
            ).toLowerCase();

        if (email) {
            return "email:" +
                email;
        }

        return "";
    }

    function syncOwner() {
        const user =
            getCurrentUser();

        const ownerKey =
            getOwnerKey(
                user
            );

        if (
            ACCOUNT.ownerKey &&
            ownerKey &&
            ACCOUNT.ownerKey !==
                ownerKey
        ) {
            /*
             * A different authenticated
             * identity must never inherit
             * the previous user's profile.
             */
            clearProfile(
                "owner-changed"
            );
        }

        ACCOUNT.ownerKey =
            ownerKey || null;

        return ACCOUNT.ownerKey;
    }

    /* =======================================================
       AUTHENTICATION
       ======================================================= */

    function isAuthenticated() {
        return Auth.isAuthenticated();
    }

    async function requireAuthentication() {
        /*
         * First check the already-known
         * authentication state.
         */
        if (
            Auth.isAuthenticated()
        ) {
            syncOwner();

            return true;
        }

        /*
         * Otherwise ask Auth to verify
         * the backend session.
         */
        const authenticated =
            await Auth.verifySession();

        if (!authenticated) {
            clearProfile(
                "authentication-required"
            );

            ACCOUNT.state =
                ACCOUNT_STATE.UNAUTHENTICATED;

            ACCOUNT.error =
                null;

            throw new Error(
                "Authentication is required."
            );
        }

        syncOwner();

        return true;
    }

    /* =======================================================
       ACCOUNT STATE
       ======================================================= */

    function getProfile() {
        return clone(
            ACCOUNT.profile
        );
    }

    function getCachedProfile() {
        return getProfile();
    }

    function getState() {
        return ACCOUNT.state;
    }

    function isInitialized() {
        return Boolean(
            ACCOUNT.initialized
        );
    }

    function isLoading() {
        return Boolean(
            ACCOUNT.loading
        );
    }

    function getError() {
        return ACCOUNT.error;
    }

    function getSnapshot() {
        return {
            profile:
                clone(
                    ACCOUNT.profile
                ),

            state:
                ACCOUNT.state,

            initialized:
                ACCOUNT.initialized,

            loading:
                ACCOUNT.loading,

            error:
                ACCOUNT.error,

            ownerKey:
                ACCOUNT.ownerKey
        };
    }

    function notify(
        reason
    ) {
        const snapshot =
            getSnapshot();

        subscribers.forEach(
            function (listener) {
                try {
                    listener(
                        clone(snapshot),
                        reason
                    );
                } catch (error) {
                    console.error(
                        "[CyberNexus Account] Subscriber error:",
                        error
                    );
                }
            }
        );
    }

    function setLoading(
        loading,
        reason
    ) {
        ACCOUNT.loading =
            Boolean(
                loading
            );

        if (ACCOUNT.loading) {
            ACCOUNT.state =
                ACCOUNT_STATE.LOADING;
        }

        notify(
            reason ||
                (
                    ACCOUNT.loading
                        ? "loading"
                        : "loading-complete"
                )
        );
    }

    function setProfile(
        profile,
        reason
    ) {
        const normalized =
            normalizeObject(
                profile
            );

        ACCOUNT.profile =
            normalized;

        ACCOUNT.error =
            null;

        ACCOUNT.state =
            normalized
                ? ACCOUNT_STATE.READY
                : ACCOUNT_STATE.UNKNOWN;

        syncOwner();

        notify(
            reason ||
                "profile-updated"
        );

        return getProfile();
    }

    function clearProfile(
        reason
    ) {
        const hadProfile =
            ACCOUNT.profile !==
            null;

        ACCOUNT.profile =
            null;

        ACCOUNT.error =
            null;

        if (
            ACCOUNT.state !==
                ACCOUNT_STATE.UNAUTHENTICATED
        ) {
            ACCOUNT.state =
                ACCOUNT_STATE.UNKNOWN;
        }

        if (hadProfile) {
            notify(
                reason ||
                    "profile-cleared"
            );
        }

        return null;
    }

    function setError(
        error,
        reason
    ) {
        ACCOUNT.error =
            error || null;

        ACCOUNT.state =
            ACCOUNT_STATE.ERROR;

        notify(
            reason ||
                "account-error"
        );
    }

    /* =======================================================
       REQUEST WRAPPER
       ======================================================= */

    async function execute(
        operation,
        reason
    ) {
        await requireAuthentication();

        setLoading(
            true,
            reason + "-started"
        );

        try {
            const response =
                await operation();

            ACCOUNT.error =
                null;

            return response;
        } catch (error) {
            /*
             * A backend authentication failure
             * means the account cache is no
             * longer valid for the current session.
             */
            if (
                isUnauthorizedError(
                    error
                )
            ) {
                clearProfile(
                    "authentication-expired"
                );

                ACCOUNT.state =
                    ACCOUNT_STATE.UNAUTHENTICATED;
            } else {
                ACCOUNT.error =
                    error;

                /*
                 * Do not erase a valid cached
                 * profile because of a temporary
                 * network/server failure.
                 */
                ACCOUNT.state =
                    ACCOUNT.profile
                        ? ACCOUNT_STATE.READY
                        : ACCOUNT_STATE.ERROR;
            }

            notify(
                reason + "-error"
            );

            throw error;
        } finally {
            ACCOUNT.loading =
                false;

            notify(
                reason + "-complete"
            );
        }
    }

    /* =======================================================
       ACCOUNT
       ======================================================= */

    async function getAccount() {
        return execute(
            function () {
                return Api.get(
                    ENDPOINTS.account
                );
            },
            "get-account"
        ).then(
            function (response) {
                if (
                    isSuccessfulResponse(
                        response
                    )
                ) {
                    const profile =
                        extractProfile(
                            response
                        );

                    if (profile) {
                        setProfile(
                            profile,
                            "account-loaded"
                        );
                    }
                }

                return response;
            }
        );
    }

    /* =======================================================
       PROFILE
       ======================================================= */

    async function getProfileData() {
        return execute(
            function () {
                return Api.get(
                    ENDPOINTS.profile
                );
            },
            "get-profile"
        ).then(
            function (response) {
                if (
                    isSuccessfulResponse(
                        response
                    )
                ) {
                    const profile =
                        extractProfile(
                            response
                        );

                    if (profile) {
                        setProfile(
                            profile,
                            "profile-loaded"
                        );
                    }
                }

                return response;
            }
        );
    }

    async function updateProfile(
        data
    ) {
        const value =
            normalizeInput(
                data
            );

        return execute(
            function () {
                return Api.put(
                    ENDPOINTS.profile,
                    value
                );
            },
            "update-profile"
        ).then(
            function (response) {
                if (
                    isSuccessfulResponse(
                        response
                    )
                ) {
                    const profile =
                        extractProfile(
                            response
                        );

                    if (profile) {
                        setProfile(
                            profile,
                            "profile-updated"
                        );
                    }
                }

                return response;
            }
        );
    }

    /* =======================================================
       PROFILE UPDATE REQUESTS
       ======================================================= */

    async function requestProfileUpdate(
        data
    ) {
        return execute(
            function () {
                return Api.post(
                    ENDPOINTS.profileUpdates,
                    normalizeInput(
                        data
                    )
                );
            },
            "request-profile-update"
        );
    }

    async function getProfileUpdates() {
        return execute(
            function () {
                return Api.get(
                    ENDPOINTS.profileUpdates
                );
            },
            "get-profile-updates"
        );
    }

    /* =======================================================
       ACCOUNT STATUS
       ======================================================= */

    async function getAccountStatus() {
        return execute(
            function () {
                return Api.get(
                    ENDPOINTS.status
                );
            },
            "get-account-status"
        );
    }

    async function requestStatusChange(
        data
    ) {
        return execute(
            function () {
                return Api.post(
                    ENDPOINTS.status,
                    normalizeInput(
                        data
                    )
                );
            },
            "request-status-change"
        );
    }

    /* =======================================================
       SESSIONS
       ======================================================= */

    async function getSessions() {
        return execute(
            function () {
                return Api.get(
                    ENDPOINTS.sessions
                );
            },
            "get-sessions"
        );
    }

    async function revokeSession(
        sessionId
    ) {
        const value =
            normalizeId(
                sessionId
            );

        if (!value) {
            throw new Error(
                "Session ID is required."
            );
        }

        return execute(
            function () {
                return Api.delete(
                    ENDPOINTS.sessions +
                    "/" +
                    encodeURIComponent(
                        value
                    )
                );
            },
            "revoke-session"
        );
    }

    /* =======================================================
       PREFERENCES
       ======================================================= */

    async function getPreferences() {
        return execute(
            function () {
                return Api.get(
                    ENDPOINTS.preferences
                );
            },
            "get-preferences"
        );
    }

    async function updatePreferences(
        data
    ) {
        const value =
            normalizeInput(
                data
            );

        return execute(
            function () {
                return Api.put(
                    ENDPOINTS.preferences,
                    value
                );
            },
            "update-preferences"
        );
    }

    /* =======================================================
       INITIALIZATION
       ======================================================= */

    async function initialize() {
        if (
            initializationPromise
        ) {
            return initializationPromise;
        }

        if (
            ACCOUNT.initialized &&
            ACCOUNT.profile
        ) {
            return getProfile();
        }

        initializationPromise =
            (async function () {
                ACCOUNT.initialized =
                    true;

                syncOwner();

                /*
                 * Do not load account information
                 * from local storage.
                 *
                 * Authentication must be checked
                 * by Auth first.
                 */
                if (
                    !Auth.isAuthenticated()
                ) {
                    const authenticated =
                        await Auth.verifySession();

                    if (
                        !authenticated
                    ) {
                        clearProfile(
                            "initialization-unauthenticated"
                        );

                        ACCOUNT.state =
                            ACCOUNT_STATE.UNAUTHENTICATED;

                        return null;
                    }
                }

                syncOwner();

                try {
                    await getAccount();

                    return getProfile();
                } catch (error) {
                    /*
                     * Temporary backend/network
                     * failures should not make us
                     * pretend the account is invalid.
                     */
                    if (
                        isUnauthorizedError(
                            error
                        )
                    ) {
                        clearProfile(
                            "initialization-expired"
                        );

                        ACCOUNT.state =
                            ACCOUNT_STATE.UNAUTHENTICATED;

                        return null;
                    }

                    return getProfile();
                }
            })();

        try {
            return await initializationPromise;
        } finally {
            initializationPromise =
                null;
        }
    }

    /* =======================================================
       RESET
       ======================================================= */

    function reset() {
        ACCOUNT.profile =
            null;

        ACCOUNT.state =
            ACCOUNT_STATE.UNKNOWN;

        ACCOUNT.initialized =
            false;

        ACCOUNT.loading =
            false;

        ACCOUNT.error =
            null;

        ACCOUNT.ownerKey =
            null;

        initializationPromise =
            null;

        notify(
            "reset"
        );

        return null;
    }

    /* =======================================================
       AUTH STATE SYNCHRONIZATION
       ======================================================= */

    function handleAuthChange(
        snapshot
    ) {
        if (
            !snapshot ||
            typeof snapshot !==
                "object"
        ) {
            return;
        }

        if (
            snapshot.authenticated
        ) {
            const ownerKey =
                getOwnerKey(
                    snapshot.user
                );

            if (
                ACCOUNT.ownerKey &&
                ownerKey &&
                ACCOUNT.ownerKey !==
                    ownerKey
            ) {
                reset();
            }

            ACCOUNT.ownerKey =
                ownerKey || null;

            return;
        }

        /*
         * Once authentication becomes
         * unauthenticated, account data
         * must be discarded.
         */
        clearProfile(
            "authentication-changed"
        );

        ACCOUNT.ownerKey =
            null;

        ACCOUNT.state =
            ACCOUNT_STATE.UNAUTHENTICATED;

        ACCOUNT.initialized =
            false;

        notify(
            "authentication-cleared"
        );
    }

    let unsubscribeAuth =
        null;

    if (
        typeof Auth.subscribe ===
        "function"
    ) {
        unsubscribeAuth =
            Auth.subscribe(
                handleAuthChange
            );
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

    const Account =
        Object.freeze({
            constants:
                Object.freeze({
                    ENDPOINTS,
                    ACCOUNT_STATE
                }),

            initialize,
            reset,

            getAccount,

            getProfile:
                getProfileData,

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

            isAuthenticated,

            getState,
            isInitialized,
            isLoading,
            getError,
            getSnapshot,

            subscribe,
            unsubscribe,
            clearSubscribers
        });

    /* =======================================================
       GLOBAL EXPORT
       ======================================================= */

    CyberNexus.Account =
        Account;

    /*
     * Backward-compatible alias.
     *
     * Canonical:
     *
     *     window.CyberNexus.Account
     */
    window.CyberNexusAccount =
        Account;

})(window);
