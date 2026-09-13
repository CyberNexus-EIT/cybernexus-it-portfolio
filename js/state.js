/*
 * CyberNexus IT Portfolio Platform
 * File: frontend/js/state.js
 *
 * Responsibility:
 * - Central frontend application state
 * - Current page and section
 * - Navigation state
 * - Side-panel state
 * - Connection state
 * - Global UI state
 * - State subscriptions
 * - Safe state persistence
 * - State validation and normalization
 *
 * Does NOT own:
 * - HTTP requests
 * - API calls
 * - Authentication
 * - Account operations
 * - Chat/AI operations
 * - Voice operations
 * - DOM-specific application logic
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

    const STORAGE_KEY =
        "cybernexus-it-portfolio-state";

    const STATE_VERSION = 1;

    const PERSISTENCE_DELAY = 50;

    const PAGES = Object.freeze([
        "portfolio",
        "projects",
        "skills",
        "experience",
        "contact",
        "privacy",
        "terms"
    ]);

    const CONNECTION_STATES = Object.freeze([
        "connecting",
        "online",
        "offline",
        "maintenance"
    ]);

    const STATUS_LABELS = Object.freeze({
        connecting: "Connecting",
        online: "Online",
        offline: "Offline",
        maintenance: "Maintenance"
    });

    const NOTIFICATION_TYPES = Object.freeze([
        "info",
        "success",
        "warning",
        "error"
    ]);

    const DEFAULT_NOTIFICATION_DURATION = 4000;

    /* =======================================================
       DEFAULT STATE
    ======================================================= */

    const DEFAULT_STATE = Object.freeze({
        version: STATE_VERSION,

        app: {
            initialized: false,
            ready: false
        },

        navigation: {
            page: "portfolio",
            section: "",
            previousPage: "",
            previousSection: ""
        },

        sidePanel: {
            open: true,
            collapsed: false
        },

        connection: {
            state: "connecting",
            endpoint: "",
            lastChecked: null,
            latency: null
        },

        ui: {
            loading: false,
            busy: false,
            modal: null,
            notification: null
        }
    });

    /* =======================================================
       INTERNAL STATE
    ======================================================= */

    let state = clone(DEFAULT_STATE);

    const subscribers = new Set();

    let persistenceTimer = null;

    let storageAvailable = null;

    /* =======================================================
       BASIC UTILITIES
    ======================================================= */

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
            Object.getPrototypeOf(value);

        return (
            prototype === Object.prototype ||
            prototype === null
        );
    }

    function mergeObjects(base, update) {
        const result =
            isPlainObject(base)
                ? clone(base)
                : {};

        if (!isPlainObject(update)) {
            return result;
        }

        Object.keys(update).forEach(
            function (key) {
                const incoming =
                    update[key];

                if (
                    isPlainObject(
                        result[key]
                    ) &&
                    isPlainObject(
                        incoming
                    )
                ) {
                    result[key] =
                        mergeObjects(
                            result[key],
                            incoming
                        );
                } else {
                    result[key] =
                        clone(incoming);
                }
            }
        );

        return result;
    }

    function valuesEqual(
        first,
        second
    ) {
        if (
            first === second
        ) {
            return true;
        }

        try {
            return (
                JSON.stringify(first) ===
                JSON.stringify(second)
            );
        } catch (error) {
            return false;
        }
    }

    function normalizeString(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    /* =======================================================
       PAGE NORMALIZATION
    ======================================================= */

    function normalizePage(page) {
        if (
            typeof page !==
            "string"
        ) {
            return (
                DEFAULT_STATE
                    .navigation
                    .page
            );
        }

        const normalized =
            page
                .trim()
                .toLowerCase()
                .replace(
                    /^\/+/,
                    ""
                )
                .replace(
                    /\.html$/i,
                    ""
                )
                .replace(
                    /\/+$/,
                    ""
                );

        return PAGES.includes(
            normalized
        )
            ? normalized
            : DEFAULT_STATE
                  .navigation
                  .page;
    }

    function normalizeSection(section) {
        if (
            typeof section !==
            "string"
        ) {
            return "";
        }

        return section
            .trim()
            .replace(
                /^#+/,
                ""
            );
    }

    /* =======================================================
       CONNECTION NORMALIZATION
    ======================================================= */

    function normalizeConnectionState(
        connectionState
    ) {
        if (
            typeof connectionState !==
            "string"
        ) {
            return (
                DEFAULT_STATE
                    .connection
                    .state
            );
        }

        const normalized =
            connectionState
                .trim()
                .toLowerCase();

        return CONNECTION_STATES.includes(
            normalized
        )
            ? normalized
            : DEFAULT_STATE
                  .connection
                  .state;
    }

    function normalizeLatency(
        latency
    ) {
        if (
            typeof latency !==
                "number" ||
            !Number.isFinite(
                latency
            )
        ) {
            return null;
        }

        return Math.max(
            0,
            latency
        );
    }

    function normalizeTimestamp(
        timestamp
    ) {
        if (
            timestamp === null ||
            timestamp === undefined ||
            timestamp === ""
        ) {
            return null;
        }

        if (
            timestamp instanceof Date
        ) {
            if (
                Number.isNaN(
                    timestamp.getTime()
                )
            ) {
                return null;
            }

            return timestamp.toISOString();
        }

        if (
            typeof timestamp !==
            "string"
        ) {
            return null;
        }

        const value =
            timestamp.trim();

        if (!value) {
            return null;
        }

        const parsed =
            Date.parse(value);

        if (
            Number.isNaN(parsed)
        ) {
            return null;
        }

        return new Date(
            parsed
        ).toISOString();
    }

    function normalizeEndpoint(
        endpoint
    ) {
        if (
            typeof endpoint !==
            "string"
        ) {
            return "";
        }

        return endpoint.trim();
    }

    /* =======================================================
       UI NORMALIZATION
    ======================================================= */

    function normalizeModal(
        modal
    ) {
        if (
            modal === null ||
            modal === undefined
        ) {
            return null;
        }

        if (
            typeof modal !==
            "string"
        ) {
            return null;
        }

        const value =
            modal.trim();

        return value || null;
    }

    function normalizeNotification(
        notification
    ) {
        if (
            notification === null ||
            notification === undefined
        ) {
            return null;
        }

        if (
            !isPlainObject(
                notification
            )
        ) {
            return null;
        }

        const requestedType =
            normalizeString(
                notification.type
            ).toLowerCase();

        const type =
            NOTIFICATION_TYPES.includes(
                requestedType
            )
                ? requestedType
                : "info";

        const message =
            typeof notification.message ===
            "string"
                ? notification.message.trim()
                : "";

        if (!message) {
            return null;
        }

        const duration =
            typeof notification.duration ===
                "number" &&
            Number.isFinite(
                notification.duration
            )
                ? Math.max(
                      0,
                      notification.duration
                  )
                : DEFAULT_NOTIFICATION_DURATION;

        return {
            type,
            message,
            duration
        };
    }

    /* =======================================================
       STATE NORMALIZATION
    ======================================================= */

    function normalizeState(
        candidate
    ) {
        const source =
            isPlainObject(candidate)
                ? candidate
                : {};

        const navigation =
            isPlainObject(
                source.navigation
            )
                ? source.navigation
                : {};

        const sidePanel =
            isPlainObject(
                source.sidePanel
            )
                ? source.sidePanel
                : {};

        const connection =
            isPlainObject(
                source.connection
            )
                ? source.connection
                : {};

        const app =
            isPlainObject(
                source.app
            )
                ? source.app
                : {};

        const ui =
            isPlainObject(
                source.ui
            )
                ? source.ui
                : {};

        const page =
            normalizePage(
                navigation.page
            );

        const section =
            normalizeSection(
                navigation.section
            );

        const previousPage =
            navigation.previousPage
                ? normalizePage(
                      navigation.previousPage
                  )
                : "";

        const previousSection =
            normalizeSection(
                navigation.previousSection
            );

        const collapsed =
            Boolean(
                sidePanel.collapsed
            );

        /*
         * A collapsed panel is never
         * considered open.
         */
        const open =
            collapsed
                ? false
                : typeof sidePanel.open ===
                      "boolean"
                    ? sidePanel.open
                    : DEFAULT_STATE
                          .sidePanel
                          .open;

        const connectionState =
            normalizeConnectionState(
                connection.state
            );

        const endpoint =
            normalizeEndpoint(
                connection.endpoint
            );

        const lastChecked =
            normalizeTimestamp(
                connection.lastChecked
            );

        const latency =
            normalizeLatency(
                connection.latency
            );

        const notification =
            normalizeNotification(
                ui.notification
            );

        return {
            version: STATE_VERSION,

            app: {
                initialized:
                    Boolean(
                        app.initialized
                    ),

                ready:
                    Boolean(
                        app.ready
                    )
            },

            navigation: {
                page,
                section,
                previousPage,
                previousSection
            },

            sidePanel: {
                open,
                collapsed
            },

            connection: {
                state:
                    connectionState,
                endpoint,
                lastChecked,
                latency
            },

            ui: {
                loading:
                    Boolean(
                        ui.loading
                    ),

                busy:
                    Boolean(
                        ui.busy
                    ),

                modal:
                    normalizeModal(
                        ui.modal
                    ),

                notification
            }
        };
    }

    /* =======================================================
       STORAGE
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
                "__cybernexus_state_test__";

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

    function invalidateStorageAvailability() {
        storageAvailable =
            null;
    }

    /* =======================================================
       PERSISTED STATE
    ======================================================= */

    function getPersistedState() {
        /*
         * Only intentionally safe,
         * non-sensitive configuration
         * is persisted.
         *
         * Do NOT persist:
         * - authentication tokens
         * - passwords
         * - account data
         * - session data
         * - API responses
         * - notifications
         * - modal state
         * - loading/busy state
         * - runtime connection status
         * - latency
         */
        return {
            version:
                STATE_VERSION,

            navigation: {
                page:
                    state.navigation.page,

                section:
                    state.navigation.section,

                previousPage:
                    state.navigation
                        .previousPage,

                previousSection:
                    state.navigation
                        .previousSection
            },

            sidePanel: {
                open:
                    state.sidePanel.open,

                collapsed:
                    state.sidePanel.collapsed
            },

            connection: {
                endpoint:
                    state.connection.endpoint
            }
        };
    }

    function save() {
        if (
            !canUseStorage()
        ) {
            return false;
        }

        try {
            const payload =
                getPersistedState();

            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(
                    payload
                )
            );

            return true;
        } catch (error) {
            invalidateStorageAvailability();

            console.warn(
                "[CyberNexus State] Unable to save state:",
                error
            );

            return false;
        }
    }

    function scheduleSave() {
        if (
            persistenceTimer !==
            null
        ) {
            window.clearTimeout(
                persistenceTimer
            );
        }

        persistenceTimer =
            window.setTimeout(
                function () {
                    persistenceTimer =
                        null;

                    save();
                },
                PERSISTENCE_DELAY
            );
    }

    function cancelScheduledSave() {
        if (
            persistenceTimer ===
            null
        ) {
            return;
        }

        window.clearTimeout(
            persistenceTimer
        );

        persistenceTimer =
            null;
    }

    /* =======================================================
       STATE MIGRATION
    ======================================================= */

    function migratePersistedState(
        saved
    ) {
        if (
            !isPlainObject(saved)
        ) {
            return null;
        }

        const version =
            Number(
                saved.version || 0
            );

        /*
         * Future state versions cannot
         * safely be interpreted by an
         * older frontend.
         */
        if (
            Number.isFinite(
                version
            ) &&
            version >
                STATE_VERSION
        ) {
            return null;
        }

        /*
         * Version 0 / legacy state.
         *
         * Current persisted structure is
         * already compatible with the
         * current state model, so merge
         * it through normalization.
         */
        if (
            version <=
            STATE_VERSION
        ) {
            return saved;
        }

        return null;
    }

    function load() {
        if (
            !canUseStorage()
        ) {
            return false;
        }

        try {
            const raw =
                window.localStorage.getItem(
                    STORAGE_KEY
                );

            if (!raw) {
                return false;
            }

            let saved;

            try {
                saved =
                    JSON.parse(raw);
            } catch (error) {
                console.warn(
                    "[CyberNexus State] Saved state contains invalid JSON."
                );

                window.localStorage.removeItem(
                    STORAGE_KEY
                );

                return false;
            }

            const migrated =
                migratePersistedState(
                    saved
                );

            if (!migrated) {
                /*
                 * Unsupported future state.
                 * Do not overwrite it.
                 */
                return false;
            }

            const normalized =
                normalizeState(
                    mergeObjects(
                        DEFAULT_STATE,
                        migrated
                    )
                );

            /*
             * Runtime-only values must
             * always start fresh.
             */
            normalized.app =
                clone(
                    DEFAULT_STATE.app
                );

            normalized.connection.state =
                DEFAULT_STATE
                    .connection
                    .state;

            normalized.connection.lastChecked =
                null;

            normalized.connection.latency =
                null;

            normalized.ui =
                clone(
                    DEFAULT_STATE.ui
                );

            state =
                normalized;

            notify(
                "state-loaded",
                false
            );

            return true;
        } catch (error) {
            console.warn(
                "[CyberNexus State] Unable to load state:",
                error
            );

            return false;
        }
    }

    function clearSavedState() {
        cancelScheduledSave();

        if (
            !canUseStorage()
        ) {
            return false;
        }

        try {
            window.localStorage.removeItem(
                STORAGE_KEY
            );

            return true;
        } catch (error) {
            invalidateStorageAvailability();

            console.warn(
                "[CyberNexus State] Unable to clear saved state:",
                error
            );

            return false;
        }
    }

    /* =======================================================
       STATE NOTIFICATION
    ======================================================= */

    function notify(
        reason,
        persist
    ) {
        const snapshot =
            getState();

        subscribers.forEach(
            function (listener) {
                try {
                    /*
                     * Every subscriber receives
                     * an isolated snapshot.
                     */
                    listener(
                        clone(snapshot),
                        reason
                    );
                } catch (error) {
                    console.error(
                        "[CyberNexus State] Subscriber error:",
                        error
                    );
                }
            }
        );

        if (persist) {
            scheduleSave();
        }
    }

    /* =======================================================
       GET STATE
    ======================================================= */

    function getState() {
        return clone(state);
    }

    function get(path) {
        if (!path) {
            return getState();
        }

        const keys =
            String(path)
                .split(".")
                .filter(Boolean);

        let value =
            state;

        for (
            const key of keys
        ) {
            if (
                value === null ||
                typeof value !==
                    "object" ||
                !(key in value)
            ) {
                return undefined;
            }

            value =
                value[key];
        }

        return clone(value);
    }

    /* =======================================================
       SET STATE
    ======================================================= */

    function setState(
        update,
        reason
    ) {
        const current =
            getState();

        let nextUpdate =
            update;

        if (
            typeof nextUpdate ===
            "function"
        ) {
            nextUpdate =
                nextUpdate(
                    current
                );
        }

        if (
            !isPlainObject(
                nextUpdate
            )
        ) {
            return current;
        }

        const merged =
            mergeObjects(
                state,
                nextUpdate
            );

        const normalized =
            normalizeState(
                merged
            );

        if (
            valuesEqual(
                state,
                normalized
            )
        ) {
            return getState();
        }

        state =
            normalized;

        notify(
            reason ||
                "state-updated",
            true
        );

        return getState();
    }

    function resetState(
        reason
    ) {
        cancelScheduledSave();

        state =
            clone(
                DEFAULT_STATE
            );

        notify(
            reason ||
                "state-reset",
            true
        );

        return getState();
    }

    /* =======================================================
       NAVIGATION STATE
    ======================================================= */

    function setPage(
        page,
        options
    ) {
        const normalizedPage =
            normalizePage(
                page
            );

        const settings =
            isPlainObject(
                options
            )
                ? options
                : {};

        const currentPage =
            state.navigation.page;

        const currentSection =
            state.navigation.section;

        const nextSection =
            settings.section !==
            undefined
                ? normalizeSection(
                      settings.section
                  )
                : currentSection;

        if (
            normalizedPage ===
                currentPage &&
            nextSection ===
                currentSection
        ) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                {
                    navigation: {
                        page:
                            normalizedPage,

                        section:
                            nextSection,

                        previousPage:
                            currentPage,

                        previousSection:
                            currentSection
                    }
                }
            );

        notify(
            "page-changed",
            true
        );

        return getState();
    }

    function setSection(
        section
    ) {
        const normalizedSection =
            normalizeSection(
                section
            );

        const currentSection =
            state.navigation.section;

        if (
            normalizedSection ===
            currentSection
        ) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                {
                    navigation: {
                        section:
                            normalizedSection,

                        previousSection:
                            currentSection
                    }
                }
            );

        notify(
            "section-changed",
            true
        );

        return getState();
    }

    function setNavigation(
        page,
        section
    ) {
        const normalizedPage =
            normalizePage(
                page
            );

        const normalizedSection =
            normalizeSection(
                section
            );

        const currentPage =
            state.navigation.page;

        const currentSection =
            state.navigation.section;

        if (
            normalizedPage ===
                currentPage &&
            normalizedSection ===
                currentSection
        ) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                {
                    navigation: {
                        page:
                            normalizedPage,

                        section:
                            normalizedSection,

                        previousPage:
                            currentPage,

                        previousSection:
                            currentSection
                    }
                }
            );

        notify(
            "navigation-changed",
            true
        );

        return getState();
    }

    function getCurrentPage() {
        return (
            state.navigation.page
        );
    }

    function getCurrentSection() {
        return (
            state.navigation.section
        );
    }

    function getPreviousPage() {
        return (
            state.navigation.previousPage
        );
    }

    function getPreviousSection() {
        return (
            state.navigation
                .previousSection
        );
    }

    /* =======================================================
       SIDE PANEL STATE
    ======================================================= */

    function setSidePanelOpen(
        open
    ) {
        const requested =
            Boolean(open);

        /*
         * Opening a collapsed panel
         * automatically restores it.
         */
        if (requested) {
            if (
                state.sidePanel.open &&
                !state.sidePanel.collapsed
            ) {
                return getState();
            }

            state =
                mergeObjects(
                    state,
                    {
                        sidePanel: {
                            open: true,
                            collapsed: false
                        }
                    }
                );

            notify(
                "side-panel-open-changed",
                true
            );

            return getState();
        }

        /*
         * Closing the panel does not
         * automatically collapse it.
         */
        if (
            !state.sidePanel.open
        ) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                {
                    sidePanel: {
                        open: false
                    }
                }
            );

        notify(
            "side-panel-open-changed",
            true
        );

        return getState();
    }

    function openSidePanel() {
        return setSidePanelOpen(
            true
        );
    }

    function closeSidePanel() {
        return setSidePanelOpen(
            false
        );
    }

    function toggleSidePanel() {
        return setSidePanelOpen(
            !state.sidePanel.open
        );
    }

    function setSidePanelCollapsed(
        collapsed
    ) {
        const value =
            Boolean(collapsed);

        if (value) {
            if (
                state.sidePanel
                    .collapsed &&
                !state.sidePanel.open
            ) {
                return getState();
            }

            state =
                mergeObjects(
                    state,
                    {
                        sidePanel: {
                            collapsed:
                                true,

                            open:
                                false
                        }
                    }
                );

            notify(
                "side-panel-collapse-changed",
                true
            );

            return getState();
        }

        /*
         * Expanding/restoring the panel
         * also opens it.
         */
        if (
            !state.sidePanel
                .collapsed &&
            state.sidePanel.open
        ) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                {
                    sidePanel: {
                        collapsed:
                            false,

                        open:
                            true
                    }
                }
            );

        notify(
            "side-panel-expand-changed",
            true
        );

        return getState();
    }

    function collapseSidePanel() {
        return setSidePanelCollapsed(
            true
        );
    }

    function expandSidePanel() {
        return setSidePanelCollapsed(
            false
        );
    }

    function restoreSidePanel() {
        const changed =
            state.sidePanel
                .collapsed ||
            !state.sidePanel.open;

        if (!changed) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                {
                    sidePanel: {
                        collapsed:
                            false,

                        open:
                            true
                    }
                }
            );

        notify(
            "side-panel-restored",
            true
        );

        return getState();
    }

    function toggleSidePanelCollapsed() {
        return setSidePanelCollapsed(
            !state.sidePanel.collapsed
        );
    }

    function getSidePanelState() {
        return clone(
            state.sidePanel
        );
    }

    function isSidePanelOpen() {
        return Boolean(
            state.sidePanel.open
        );
    }

    function isSidePanelCollapsed() {
        return Boolean(
            state.sidePanel.collapsed
        );
    }

    /* =======================================================
       CONNECTION STATE
    ======================================================= */

    function setConnectionState(
        connectionState,
        options
    ) {
        const normalizedState =
            normalizeConnectionState(
                connectionState
            );

        const settings =
            isPlainObject(
                options
            )
                ? options
                : {};

        const previous =
            state.connection;

        const endpoint =
            settings.endpoint !==
            undefined
                ? normalizeEndpoint(
                      settings.endpoint
                  )
                : previous.endpoint;

        const lastChecked =
            settings.lastChecked !==
            undefined
                ? normalizeTimestamp(
                      settings.lastChecked
                  )
                : new Date().toISOString();

        const latency =
            settings.latency !==
            undefined
                ? normalizeLatency(
                      settings.latency
                  )
                : previous.latency;

        const changed =
            normalizedState !==
                previous.state ||
            endpoint !==
                previous.endpoint ||
            lastChecked !==
                previous.lastChecked ||
            latency !==
                previous.latency;

        if (!changed) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                {
                    connection: {
                        state:
                            normalizedState,

                        endpoint,

                        lastChecked,

                        latency
                    }
                }
            );

        /*
         * Only endpoint changes require
         * persistence.
         */
        notify(
            "connection-changed",
            endpoint !==
                previous.endpoint
        );

        return getState();
    }

    function setEndpoint(
        endpoint
    ) {
        const value =
            normalizeEndpoint(
                endpoint
            );

        if (
            value ===
            state.connection.endpoint
        ) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                {
                    connection: {
                        endpoint:
                            value
                    }
                }
            );

        notify(
            "endpoint-changed",
            true
        );

        return getState();
    }

    function setLatency(
        latency
    ) {
        const value =
            normalizeLatency(
                latency
            );

        const checked =
            new Date().toISOString();

        if (
            value ===
                state.connection.latency &&
            checked ===
                state.connection.lastChecked
        ) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                {
                    connection: {
                        latency:
                            value,

                        lastChecked:
                            checked
                    }
                }
            );

        /*
         * Runtime-only information.
         */
        notify(
            "latency-changed",
            false
        );

        return getState();
    }

    function getConnectionState() {
        return clone(
            state.connection
        );
    }

    function getConnectionStatus() {
        return (
            state.connection.state
        );
    }

    function getStatusLabel() {
        return (
            STATUS_LABELS[
                state.connection.state
            ] ||
            STATUS_LABELS.offline
        );
    }

    /* =======================================================
       APPLICATION STATE
    ======================================================= */

    function setInitialized(
        value
    ) {
        const next =
            Boolean(value);

        if (
            next ===
            state.app.initialized
        ) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                {
                    app: {
                        initialized:
                            next
                    }
                }
            );

        notify(
            "initialized-changed",
            false
        );

        return getState();
    }

    function setReady(
        value
    ) {
        const next =
            Boolean(value);

        if (
            next ===
            state.app.ready
        ) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                {
                    app: {
                        ready:
                            next
                    }
                }
            );

        notify(
            "ready-changed",
            false
        );

        return getState();
    }

    function isInitialized() {
        return Boolean(
            state.app.initialized
        );
    }

    function isReady() {
        return Boolean(
            state.app.ready
        );
    }

    /* =======================================================
       UI STATE
    ======================================================= */

    function setLoading(
        value
    ) {
        const next =
            Boolean(value);

        if (
            next ===
            state.ui.loading
        ) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                {
                    ui: {
                        loading:
                            next
                    }
                }
            );

        notify(
            "loading-changed",
            false
        );

        return getState();
    }

    function setBusy(
        value
    ) {
        const next =
            Boolean(value);

        if (
            next ===
            state.ui.busy
        ) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                {
                    ui: {
                        busy:
                            next
                    }
                }
            );

        notify(
            "busy-changed",
            false
        );

        return getState();
    }

    function setModal(
        modal
    ) {
        const value =
            normalizeModal(
                modal
            );

        if (
            value ===
            state.ui.modal
        ) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                {
                    ui: {
                        modal:
                            value
                    }
                }
            );

        notify(
            "modal-changed",
            false
        );

        return getState();
    }

    function closeModal() {
        return setModal(
            null
        );
    }

    function setNotification(
        notification
    ) {
        const value =
            normalizeNotification(
                notification
            );

        if (
            valuesEqual(
                value,
                state.ui
                    .notification
            )
        ) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                {
                    ui: {
                        notification:
                            value
                    }
                }
            );

        notify(
            "notification-changed",
            false
        );

        return getState();
    }

    function clearNotification() {
        return setNotification(
            null
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

    const State =
        Object.freeze({
            constants:
                Object.freeze({
                    STORAGE_KEY,
                    STATE_VERSION,
                    PAGES,
                    CONNECTION_STATES,
                    STATUS_LABELS,
                    NOTIFICATION_TYPES,
                    DEFAULT_NOTIFICATION_DURATION
                }),

            getState,
            get,
            setState,
            resetState,

            setPage,
            setSection,
            setNavigation,

            getCurrentPage,
            getCurrentSection,
            getPreviousPage,
            getPreviousSection,

            setSidePanelOpen,
            openSidePanel,
            closeSidePanel,
            toggleSidePanel,

            setSidePanelCollapsed,
            collapseSidePanel,
            expandSidePanel,
            restoreSidePanel,
            toggleSidePanelCollapsed,

            getSidePanelState,
            isSidePanelOpen,
            isSidePanelCollapsed,

            setConnectionState,
            setEndpoint,
            setLatency,

            getConnectionState,
            getConnectionStatus,
            getStatusLabel,

            setInitialized,
            setReady,
            isInitialized,
            isReady,

            setLoading,
            setBusy,

            setModal,
            closeModal,

            setNotification,
            clearNotification,

            subscribe,
            unsubscribe,
            clearSubscribers,

            save,
            load,
            clearSavedState
        });

    /* =======================================================
       GLOBAL EXPORT
    ======================================================= */

    CyberNexus.State =
        State;

    /*
     * Backward-compatible global alias.
     *
     * Canonical:
     *
     *     window.CyberNexus.State
     *
     * Compatibility:
     *
     *     window.CyberNexusState
     */
    window.CyberNexusState =
        State;

    /* =======================================================
       INITIAL LOAD
    ======================================================= */

    /*
     * Load only persisted, non-sensitive
     * configuration/navigation state.
     *
     * Runtime state remains at its
     * secure defaults.
     */
    load();

})(window);
