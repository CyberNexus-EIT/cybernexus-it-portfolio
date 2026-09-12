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
        (window.CyberNexus = window.CyberNexus || {});

    /* =======================================================
       CONSTANTS
    ======================================================= */

    const STORAGE_KEY =
        "cybernexus-it-portfolio-state";

    const STATE_VERSION = 1;

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

    const PERSISTENCE_DELAY = 50;

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

    function mergeObjects(base, update) {
        const result =
            isObject(base)
                ? clone(base)
                : {};

        if (!isObject(update)) {
            return result;
        }

        Object.keys(update).forEach(function (key) {
            const incoming = update[key];

            if (
                isObject(result[key]) &&
                isObject(incoming)
            ) {
                result[key] =
                    mergeObjects(
                        result[key],
                        incoming
                    );
            } else {
                result[key] = clone(incoming);
            }
        });

        return result;
    }

    function normalizePage(page) {
        if (typeof page !== "string") {
            return DEFAULT_STATE.navigation.page;
        }

        const normalized =
            page
                .trim()
                .toLowerCase()
                .replace(/\.html$/i, "");

        return PAGES.includes(normalized)
            ? normalized
            : DEFAULT_STATE.navigation.page;
    }

    function normalizeSection(section) {
        if (typeof section !== "string") {
            return "";
        }

        return section.trim();
    }

    function normalizeConnectionState(
        connectionState
    ) {
        return CONNECTION_STATES.includes(
            connectionState
        )
            ? connectionState
            : DEFAULT_STATE.connection.state;
    }

    function normalizeLatency(latency) {
        if (
            typeof latency !== "number" ||
            !Number.isFinite(latency)
        ) {
            return null;
        }

        return Math.max(0, latency);
    }

    function normalizeTimestamp(timestamp) {
        if (
            timestamp === null ||
            timestamp === undefined ||
            timestamp === ""
        ) {
            return null;
        }

        if (typeof timestamp !== "string") {
            return null;
        }

        const value = timestamp.trim();

        if (!value) {
            return null;
        }

        const parsed = Date.parse(value);

        return Number.isNaN(parsed)
            ? null
            : new Date(parsed).toISOString();
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

        if (!isObject(notification)) {
            return null;
        }

        return {
            type:
                typeof notification.type === "string"
                    ? notification.type.trim() || "info"
                    : "info",

            message:
                typeof notification.message === "string"
                    ? notification.message
                    : "",

            duration:
                typeof notification.duration === "number" &&
                Number.isFinite(notification.duration)
                    ? Math.max(
                          0,
                          notification.duration
                      )
                    : 4000
        };
    }

    function notificationsEqual(
        first,
        second
    ) {
        return (
            JSON.stringify(first) ===
            JSON.stringify(second)
        );
    }

    /* =======================================================
       PERSISTENCE
    ======================================================= */

    function canUseStorage() {
        try {
            if (
                typeof window.localStorage ===
                "undefined"
            ) {
                return false;
            }

            const testKey =
                "__cybernexus_storage_test__";

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

    function getPersistedState() {
        return {
            version: STATE_VERSION,

            navigation:
                clone(
                    state.navigation
                ),

            sidePanel:
                clone(
                    state.sidePanel
                ),

            connection: {
                endpoint:
                    state.connection.endpoint
            }
        };
    }

    function save() {
        if (!canUseStorage()) {
            return false;
        }

        try {
            const payload =
                getPersistedState();

            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(payload)
            );

            return true;
        } catch (error) {
            console.warn(
                "[CyberNexus State] Unable to save state:",
                error
            );

            return false;
        }
    }

    function scheduleSave() {
        if (persistenceTimer !== null) {
            window.clearTimeout(
                persistenceTimer
            );
        }

        persistenceTimer =
            window.setTimeout(
                function () {
                    persistenceTimer = null;
                    save();
                },
                PERSISTENCE_DELAY
            );
    }

    function cancelScheduledSave() {
        if (persistenceTimer === null) {
            return;
        }

        window.clearTimeout(
            persistenceTimer
        );

        persistenceTimer = null;
    }

    function load() {
        if (!canUseStorage()) {
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

            const saved =
                JSON.parse(raw);

            if (
                !saved ||
                typeof saved !== "object" ||
                Array.isArray(saved)
            ) {
                return false;
            }

            /*
             * Reject unsupported future state
             * versions instead of guessing how
             * to interpret them.
             */
            if (
                saved.version !== undefined &&
                Number(saved.version) >
                    STATE_VERSION
            ) {
                return false;
            }

            const navigation =
                isObject(
                    saved.navigation
                )
                    ? saved.navigation
                    : {};

            const sidePanel =
                isObject(
                    saved.sidePanel
                )
                    ? saved.sidePanel
                    : {};

            const connection =
                isObject(
                    saved.connection
                )
                    ? saved.connection
                    : {};

            const loadedPage =
                navigation.page !== undefined
                    ? normalizePage(
                          navigation.page
                      )
                    : state.navigation.page;

            const loadedSection =
                navigation.section !== undefined
                    ? normalizeSection(
                          navigation.section
                      )
                    : state.navigation.section;

            const loadedPreviousPage =
                navigation.previousPage
                    ? normalizePage(
                          navigation.previousPage
                      )
                    : "";

            const loadedPreviousSection =
                navigation.previousSection !==
                undefined
                    ? normalizeSection(
                          navigation.previousSection
                      )
                    : "";

            const loadedOpen =
                typeof sidePanel.open ===
                "boolean"
                    ? sidePanel.open
                    : state.sidePanel.open;

            const loadedCollapsed =
                typeof sidePanel.collapsed ===
                "boolean"
                    ? sidePanel.collapsed
                    : state.sidePanel.collapsed;

            /*
             * A collapsed panel is always closed.
             * An expanded panel preserves the
             * saved open state.
             */
            const normalizedCollapsed =
                loadedCollapsed;

            const normalizedOpen =
                normalizedCollapsed
                    ? false
                    : loadedOpen;

            const loadedEndpoint =
                typeof connection.endpoint ===
                "string"
                    ? connection.endpoint.trim()
                    : state.connection.endpoint;

            state =
                mergeObjects(state, {
                    navigation: {
                        page: loadedPage,
                        section: loadedSection,
                        previousPage:
                            loadedPreviousPage,
                        previousSection:
                            loadedPreviousSection
                    },

                    sidePanel: {
                        open: normalizedOpen,
                        collapsed:
                            normalizedCollapsed
                    },

                    connection: {
                        endpoint:
                            loadedEndpoint
                    }
                });

            notify("state-loaded");

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

        if (!canUseStorage()) {
            return false;
        }

        try {
            window.localStorage.removeItem(
                STORAGE_KEY
            );

            return true;
        } catch (error) {
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

    function notify(reason, persist) {
        const snapshot = getState();

        subscribers.forEach(function (listener) {
            try {
                listener(snapshot, reason);
            } catch (error) {
                console.error(
                    "[CyberNexus State] Subscriber error:",
                    error
                );
            }
        });

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

        let value = state;

        for (const key of keys) {
            if (
                value === null ||
                typeof value !== "object" ||
                !(key in value)
            ) {
                return undefined;
            }

            value = value[key];
        }

        return clone(value);
    }

    /* =======================================================
       SET STATE
    ======================================================= */

    function setState(update, reason) {
        if (typeof update === "function") {
            update = update(getState());
        }

        if (!isObject(update)) {
            return getState();
        }

        state =
            mergeObjects(
                state,
                update
            );

        notify(
            reason || "state-updated",
            true
        );

        return getState();
    }

    function resetState(reason) {
        cancelScheduledSave();

        state =
            clone(DEFAULT_STATE);

        notify(
            reason || "state-reset",
            true
        );

        return getState();
    }

    /* =======================================================
       NAVIGATION STATE
    ======================================================= */

    function setPage(page, options) {
        const normalizedPage =
            normalizePage(page);

        const currentPage =
            state.navigation.page;

        const settings =
            isObject(options)
                ? options
                : {};

        const section =
            settings.section !== undefined
                ? normalizeSection(
                      settings.section
                  )
                : state.navigation.section;

        if (
            normalizedPage === currentPage &&
            section === state.navigation.section
        ) {
            return getState();
        }

        state =
            mergeObjects(state, {
                navigation: {
                    page: normalizedPage,
                    section: section,
                    previousPage: currentPage,
                    previousSection:
                        state.navigation.section
                }
            });

        notify(
            "page-changed",
            true
        );

        return getState();
    }

    function setSection(section) {
        const normalizedSection =
            normalizeSection(section);

        const currentSection =
            state.navigation.section;

        if (
            normalizedSection === currentSection
        ) {
            return getState();
        }

        state =
            mergeObjects(state, {
                navigation: {
                    section: normalizedSection,
                    previousSection: currentSection
                }
            });

        notify(
            "section-changed",
            true
        );

        return getState();
    }

    function setNavigation(page, section) {
        const normalizedPage =
            normalizePage(page);

        const normalizedSection =
            normalizeSection(section);

        const pageChanged =
            normalizedPage !==
            state.navigation.page;

        const sectionChanged =
            normalizedSection !==
            state.navigation.section;

        if (
            !pageChanged &&
            !sectionChanged
        ) {
            return getState();
        }

        state =
            mergeObjects(state, {
                navigation: {
                    page: normalizedPage,
                    section: normalizedSection,
                    previousPage:
                        state.navigation.page,
                    previousSection:
                        state.navigation.section
                }
            });

        notify(
            "navigation-changed",
            true
        );

        return getState();
    }

    function getCurrentPage() {
        return state.navigation.page;
    }

    function getCurrentSection() {
        return state.navigation.section;
    }

    function getPreviousPage() {
        return state.navigation.previousPage;
    }

    function getPreviousSection() {
        return state.navigation.previousSection;
    }

    /* =======================================================
       SIDE PANEL STATE
    ======================================================= */

    function setSidePanelOpen(open) {
        const value = Boolean(open);

        /*
         * Opening a collapsed panel also expands it.
         */
        if (value) {
            const changed =
                !state.sidePanel.open ||
                state.sidePanel.collapsed;

            if (!changed) {
                return getState();
            }

            state =
                mergeObjects(state, {
                    sidePanel: {
                        open: true,
                        collapsed: false
                    }
                });

            notify(
                "side-panel-open-changed",
                true
            );

            return getState();
        }

        if (
            !state.sidePanel.open &&
            !state.sidePanel.collapsed
        ) {
            return getState();
        }

        state =
            mergeObjects(state, {
                sidePanel: {
                    open: false
                }
            });

        notify(
            "side-panel-open-changed",
            true
        );

        return getState();
    }

    function openSidePanel() {
        return setSidePanelOpen(true);
    }

    function closeSidePanel() {
        return setSidePanelOpen(false);
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
                state.sidePanel.collapsed &&
                !state.sidePanel.open
            ) {
                return getState();
            }

            state =
                mergeObjects(state, {
                    sidePanel: {
                        collapsed: true,
                        open: false
                    }
                });

            notify(
                "side-panel-collapse-changed",
                true
            );

            return getState();
        }

        if (
            !state.sidePanel.collapsed
        ) {
            return getState();
        }

        state =
            mergeObjects(state, {
                sidePanel: {
                    collapsed: false,
                    open: true
                }
            });

        notify(
            "side-panel-expand-changed",
            true
        );

        return getState();
    }

    function collapseSidePanel() {
        return setSidePanelCollapsed(true);
    }

    function expandSidePanel() {
        return setSidePanelCollapsed(false);
    }

    function restoreSidePanel() {
        const changed =
            state.sidePanel.collapsed ||
            !state.sidePanel.open;

        if (!changed) {
            return getState();
        }

        state =
            mergeObjects(state, {
                sidePanel: {
                    collapsed: false,
                    open: true
                }
            });

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
            isObject(options)
                ? options
                : {};

        const endpoint =
            typeof settings.endpoint === "string"
                ? settings.endpoint.trim()
                : state.connection.endpoint;

        const lastChecked =
            settings.lastChecked !== undefined
                ? normalizeTimestamp(
                      settings.lastChecked
                  )
                : new Date().toISOString();

        const latency =
            settings.latency !== undefined
                ? normalizeLatency(
                      settings.latency
                  )
                : state.connection.latency;

        const changed =
            normalizedState !==
                state.connection.state ||
            endpoint !==
                state.connection.endpoint ||
            lastChecked !==
                state.connection.lastChecked ||
            latency !==
                state.connection.latency;

        if (!changed) {
            return getState();
        }

        state =
            mergeObjects(state, {
                connection: {
                    state: normalizedState,
                    endpoint: endpoint,
                    lastChecked: lastChecked,
                    latency: latency
                }
            });

        /*
         * Only the endpoint is persisted.
         * Runtime connection state remains
         * transient.
         */
        notify(
            "connection-changed",
            endpoint !==
                state.connection.endpoint
        );

        return getState();
    }

    function setEndpoint(endpoint) {
        const value =
            typeof endpoint === "string"
                ? endpoint.trim()
                : "";

        if (
            value ===
            state.connection.endpoint
        ) {
            return getState();
        }

        state =
            mergeObjects(state, {
                connection: {
                    endpoint: value
                }
            });

        notify(
            "endpoint-changed",
            true
        );

        return getState();
    }

    function setLatency(latency) {
        const value =
            normalizeLatency(latency);

        const checked =
            new Date().toISOString();

        state =
            mergeObjects(state, {
                connection: {
                    latency: value,
                    lastChecked: checked
                }
            });

        /*
         * Latency and lastChecked are transient
         * runtime information and are not saved.
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
        return state.connection.state;
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

    function setInitialized(value) {
        const next =
            Boolean(value);

        if (
            next ===
            state.app.initialized
        ) {
            return getState();
        }

        state =
            mergeObjects(state, {
                app: {
                    initialized: next
                }
            });

        notify(
            "initialized-changed",
            false
        );

        return getState();
    }

    function setReady(value) {
        const next =
            Boolean(value);

        if (
            next ===
            state.app.ready
        ) {
            return getState();
        }

        state =
            mergeObjects(state, {
                app: {
                    ready: next
                }
            });

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

    function setLoading(value) {
        const next =
            Boolean(value);

        if (
            next ===
            state.ui.loading
        ) {
            return getState();
        }

        state =
            mergeObjects(state, {
                ui: {
                    loading: next
                }
            });

        notify(
            "loading-changed",
            false
        );

        return getState();
    }

    function setBusy(value) {
        const next =
            Boolean(value);

        if (
            next ===
            state.ui.busy
        ) {
            return getState();
        }

        state =
            mergeObjects(state, {
                ui: {
                    busy: next
                }
            });

        notify(
            "busy-changed",
            false
        );

        return getState();
    }

    function setModal(modal) {
        const value =
            modal === null ||
            typeof modal === "string"
                ? modal
                : null;

        if (
            value ===
            state.ui.modal
        ) {
            return getState();
        }

        state =
            mergeObjects(state, {
                ui: {
                    modal: value
                }
            });

        notify(
            "modal-changed",
            false
        );

        return getState();
    }

    function closeModal() {
        return setModal(null);
    }

    function setNotification(
        notification
    ) {
        const value =
            normalizeNotification(
                notification
            );

        const current =
            state.ui.notification;

        if (
            notificationsEqual(
                value,
                current
            )
        ) {
            return getState();
        }

        state =
            mergeObjects(state, {
                ui: {
                    notification: value
                }
            });

        notify(
            "notification-changed",
            false
        );

        return getState();
    }

    function clearNotification() {
        return setNotification(null);
    }

    /* =======================================================
       SUBSCRIPTIONS
    ======================================================= */

    function subscribe(listener) {
        if (
            typeof listener !== "function"
        ) {
            return function () {};
        }

        subscribers.add(listener);

        return function unsubscribe() {
            subscribers.delete(listener);
        };
    }

    function unsubscribe(listener) {
        subscribers.delete(listener);
    }

    function clearSubscribers() {
        subscribers.clear();
    }

    /* =======================================================
       PUBLIC API
    ======================================================= */

    const State = Object.freeze({
        constants: Object.freeze({
            STORAGE_KEY,
            STATE_VERSION,
            PAGES,
            CONNECTION_STATES,
            STATUS_LABELS
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

    CyberNexus.State = State;

    /*
     * Backward-compatible global alias.
     *
     * Canonical API:
     *
     *   window.CyberNexus.State
     */
    window.CyberNexusState = State;

})(window);
