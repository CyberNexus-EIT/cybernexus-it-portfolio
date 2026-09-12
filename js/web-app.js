/* ==========================================================================
   CyberNexus IT Portfolio Platform
   File: frontend/js/web-app.js

   Responsibility:
   - Main frontend application lifecycle
   - Page navigation synchronization
   - Side-panel behavior
   - Frontend form interception
   - Keyboard interaction
   - External-link safety
   - Responsive synchronization
   - Authentication/account initialization

   Does NOT own:
   - Persistent application state
   - HTTP transport
   - API endpoint definitions
   - Authentication implementation
   - Account implementation
   - Chat/voice implementation
   - CSS presentation
   ========================================================================== */

(function (window, document) {
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

    const State =
        CyberNexus.State ||
        window.CyberNexusState;

    const Auth =
        CyberNexus.Auth ||
        window.CyberNexusAuth;

    const Account =
        CyberNexus.Account ||
        window.CyberNexusAccount;

    /* =======================================================
       APPLICATION STATE
    ======================================================= */

    const APP = {
        initialized: false,
        listeners: [],
        stateSubscription: null,
        responsiveInitialized: false,
        keyboardInitialized: false
    };

    /* =======================================================
       DOM HELPERS
    ======================================================= */

    function query(
        selector,
        root
    ) {
        return (
            root || document
        ).querySelector(selector);
    }

    function queryAll(
        selector,
        root
    ) {
        return Array.from(
            (
                root || document
            ).querySelectorAll(selector)
        );
    }

    /* =======================================================
       PAGE
    ======================================================= */

    function getPageName() {
        const path =
            window.location.pathname
                .split("/")
                .pop()
                .toLowerCase();

        const pages = {
            "": "portfolio",
            "index.html": "portfolio",
            "portfolio.html": "portfolio",
            "projects.html": "projects",
            "skills.html": "skills",
            "experience.html": "experience",
            "contact.html": "contact",
            "privacy.html": "privacy",
            "terms.html": "terms"
        };

        return (
            pages[path] ||
            "portfolio"
        );
    }

    function setCurrentPage() {
        if (
            State &&
            typeof State.setPage ===
                "function"
        ) {
            State.setPage(
                getPageName(),
                "web-app-page"
            );
        }
    }

    /* =======================================================
       NAVIGATION
    ======================================================= */

    function getPageNavigationLinks() {
        return queryAll(
            'a[data-page][href]'
        );
    }

    function updateNavigation() {
        const currentPage =
            State &&
            typeof State.getCurrentPage ===
                "function"
                ? State.getCurrentPage()
                : getPageName();

        getPageNavigationLinks().forEach(
            function (link) {
                const page =
                    String(
                        link.dataset.page ||
                            ""
                    )
                        .trim()
                        .toLowerCase();

                const current =
                    page === currentPage;

                link.classList.toggle(
                    "is-current",
                    current
                );

                if (current) {
                    link.setAttribute(
                        "aria-current",
                        "page"
                    );
                } else {
                    link.removeAttribute(
                        "aria-current"
                    );
                }
            }
        );
    }

    function initializeNavigation() {
        getPageNavigationLinks().forEach(
            function (link) {
                if (
                    link.dataset.pageBound ===
                    "true"
                ) {
                    return;
                }

                link.dataset.pageBound =
                    "true";

                link.addEventListener(
                    "click",
                    function (event) {
                        const page =
                            String(
                                link.dataset.page ||
                                    ""
                            )
                                .trim()
                                .toLowerCase();

                        const href =
                            link.getAttribute(
                                "href"
                            );

                        if (
                            !page ||
                            !href
                        ) {
                            return;
                        }

                        const currentPage =
                            State &&
                            typeof State.getCurrentPage ===
                                "function"
                                ? State.getCurrentPage()
                                : getPageName();

                        /*
                         * Keep the current page link
                         * keyboard-focusable and clickable,
                         * but avoid unnecessary reloads.
                         */
                        if (
                            page ===
                            currentPage
                        ) {
                            event.preventDefault();
                            return;
                        }

                        if (
                            State &&
                            typeof State.setPage ===
                                "function"
                        ) {
                            State.setPage(
                                page,
                                "web-app-navigation"
                            );
                        }

                        if (
                            isMobile()
                        ) {
                            closeSidePanel();
                        }
                    }
                );
            }
        );
    }

    /* =======================================================
       RESPONSIVE
    ======================================================= */

    function isMobile() {
        if (
            typeof window.matchMedia !==
            "function"
        ) {
            return false;
        }

        return window.matchMedia(
            "(max-width: 767px)"
        ).matches;
    }

    /* =======================================================
       SIDE PANEL STATE
    ======================================================= */

    function getSidePanelState() {
        if (
            State &&
            typeof State.getSidePanelState ===
                "function"
        ) {
            return (
                State.getSidePanelState() || {
                    open: false,
                    collapsed: false
                }
            );
        }

        return {
            open: false,
            collapsed: false
        };
    }

    function openSidePanel() {
        if (
            State &&
            typeof State.openSidePanel ===
                "function"
        ) {
            State.openSidePanel(
                "web-app-open-side-panel"
            );
        } else if (
            State &&
            typeof State.setSidePanelOpen ===
                "function"
        ) {
            State.setSidePanelOpen(
                true,
                "web-app-open-side-panel"
            );
        }

        syncSidePanel();
    }

    function closeSidePanel() {
        if (
            State &&
            typeof State.closeSidePanel ===
                "function"
        ) {
            State.closeSidePanel(
                "web-app-close-side-panel"
            );
        } else if (
            State &&
            typeof State.setSidePanelOpen ===
                "function"
        ) {
            State.setSidePanelOpen(
                false,
                "web-app-close-side-panel"
            );
        }

        syncSidePanel();
    }

    function toggleSidePanel() {
        const current =
            getSidePanelState();

        if (current.open) {
            closeSidePanel();
        } else {
            openSidePanel();
        }
    }

    /* =======================================================
       SIDE PANEL DOM
    ======================================================= */

    function syncSidePanel() {
        const panel =
            query(
                "[data-side-panel]"
            );

        const state =
            getSidePanelState();

        const open =
            Boolean(state.open);

        const collapsed =
            Boolean(state.collapsed);

        if (panel) {
            panel.classList.toggle(
                "is-open",
                open
            );

            panel.classList.toggle(
                "open",
                open
            );

            panel.classList.toggle(
                "is-closed",
                !open
            );

            panel.classList.toggle(
                "closed",
                !open
            );

            panel.classList.toggle(
                "is-collapsed",
                collapsed
            );

            panel.classList.toggle(
                "collapsed",
                collapsed
            );

            panel.setAttribute(
                "data-open",
                String(open)
            );

            panel.setAttribute(
                "data-collapsed",
                String(collapsed)
            );

            panel.setAttribute(
                "aria-hidden",
                String(!open)
            );
        }

        queryAll(
            "[data-side-panel-toggle]"
        ).forEach(
            function (button) {
                button.setAttribute(
                    "type",
                    "button"
                );

                button.setAttribute(
                    "aria-expanded",
                    String(open)
                );

                button.setAttribute(
                    "aria-label",
                    open
                        ? "Close Sections"
                        : "Open Sections"
                );
            }
        );

        queryAll(
            "[data-side-panel-open]"
        ).forEach(
            function (button) {
                button.setAttribute(
                    "type",
                    "button"
                );

                button.setAttribute(
                    "aria-expanded",
                    String(open)
                );

                button.setAttribute(
                    "aria-label",
                    "Open Sections"
                );

                button.disabled =
                    open;
            }
        );

        queryAll(
            "[data-side-panel-close]"
        ).forEach(
            function (button) {
                button.setAttribute(
                    "type",
                    "button"
                );

                button.setAttribute(
                    "aria-expanded",
                    String(open)
                );

                button.setAttribute(
                    "aria-label",
                    "Close Sections"
                );

                button.disabled =
                    !open;
            }
        );

        queryAll(
            "[data-side-panel-collapse]"
        ).forEach(
            function (button) {
                button.setAttribute(
                    "type",
                    "button"
                );

                button.setAttribute(
                    "aria-expanded",
                    String(!collapsed)
                );

                button.setAttribute(
                    "aria-label",
                    collapsed
                        ? "Restore Sections"
                        : "Minimize Sections"
                );

                button.disabled =
                    !open;
            }
        );

        queryAll(
            "[data-side-panel-restore]"
        ).forEach(
            function (button) {
                button.setAttribute(
                    "type",
                    "button"
                );

                button.setAttribute(
                    "aria-expanded",
                    String(!collapsed)
                );

                button.setAttribute(
                    "aria-label",
                    "Restore Sections"
                );

                button.disabled =
                    !open || !collapsed;
            }
        );

        const backdrop =
            query(
                "[data-side-panel-backdrop]"
            );

        if (backdrop) {
            backdrop.classList.toggle(
                "is-visible",
                open
            );

            backdrop.classList.toggle(
                "is-hidden",
                !open
            );

            backdrop.setAttribute(
                "aria-hidden",
                String(!open)
            );

            backdrop.hidden =
                !open;

            backdrop.style.pointerEvents =
                open
                    ? "auto"
                    : "none";

            backdrop.style.visibility =
                open
                    ? "visible"
                    : "hidden";

            backdrop.style.opacity =
                open
                    ? "1"
                    : "0";
        }

        document.body.classList.toggle(
            "side-panel-open",
            open
        );

        document.body.classList.toggle(
            "side-panel-closed",
            !open
        );

        document.body.classList.toggle(
            "side-panel-collapsed",
            collapsed
        );

        const lock =
            isMobile() &&
            open;

        document.documentElement.classList.toggle(
            "side-panel-lock",
            lock
        );

        document.body.classList.toggle(
            "side-panel-lock",
            lock
        );
    }

    /* =======================================================
       SIDE PANEL INITIALIZATION
    ======================================================= */

    function initializeSidePanel() {
        queryAll(
            "[data-side-panel-toggle]"
        ).forEach(
            function (button) {
                if (
                    button.dataset.sidePanelBound ===
                    "true"
                ) {
                    return;
                }

                button.dataset.sidePanelBound =
                    "true";

                button.addEventListener(
                    "click",
                    function (event) {
                        event.preventDefault();
                        event.stopPropagation();

                        toggleSidePanel();
                    }
                );
            }
        );

        queryAll(
            "[data-side-panel-open]"
        ).forEach(
            function (button) {
                if (
                    button.dataset.sidePanelBound ===
                    "true"
                ) {
                    return;
                }

                button.dataset.sidePanelBound =
                    "true";

                button.addEventListener(
                    "click",
                    function (event) {
                        event.preventDefault();
                        event.stopPropagation();

                        openSidePanel();
                    }
                );
            }
        );

        queryAll(
            "[data-side-panel-close]"
        ).forEach(
            function (button) {
                if (
                    button.dataset.sidePanelBound ===
                    "true"
                ) {
                    return;
                }

                button.dataset.sidePanelBound =
                    "true";

                button.addEventListener(
                    "click",
                    function (event) {
                        event.preventDefault();
                        event.stopPropagation();

                        closeSidePanel();
                    }
                );
            }
        );

        queryAll(
            "[data-side-panel-collapse]"
        ).forEach(
            function (button) {
                if (
                    button.dataset.sidePanelBound ===
                    "true"
                ) {
                    return;
                }

                button.dataset.sidePanelBound =
                    "true";

                button.addEventListener(
                    "click",
                    function (event) {
                        event.preventDefault();
                        event.stopPropagation();

                        if (!State) {
                            return;
                        }

                        if (
                            typeof State.collapseSidePanel ===
                            "function"
                        ) {
                            State.collapseSidePanel(
                                "web-app-collapse-side-panel"
                            );
                        } else if (
                            typeof State.setSidePanelCollapsed ===
                            "function"
                        ) {
                            State.setSidePanelCollapsed(
                                true,
                                "web-app-collapse-side-panel"
                            );
                        }

                        syncSidePanel();
                    }
                );
            }
        );

        queryAll(
            "[data-side-panel-restore]"
        ).forEach(
            function (button) {
                if (
                    button.dataset.sidePanelBound ===
                    "true"
                ) {
                    return;
                }

                button.dataset.sidePanelBound =
                    "true";

                button.addEventListener(
                    "click",
                    function (event) {
                        event.preventDefault();
                        event.stopPropagation();

                        if (!State) {
                            return;
                        }

                        if (
                            typeof State.restoreSidePanel ===
                            "function"
                        ) {
                            State.restoreSidePanel(
                                "web-app-restore-side-panel"
                            );
                        } else if (
                            typeof State.expandSidePanel ===
                            "function"
                        ) {
                            State.expandSidePanel(
                                "web-app-restore-side-panel"
                            );
                        } else if (
                            typeof State.setSidePanelCollapsed ===
                            "function"
                        ) {
                            State.setSidePanelCollapsed(
                                false,
                                "web-app-restore-side-panel"
                            );
                        }

                        syncSidePanel();
                    }
                );
            }
        );

        const backdrop =
            query(
                "[data-side-panel-backdrop]"
            );

        if (
            backdrop &&
            backdrop.dataset.sidePanelBound !==
                "true"
        ) {
            backdrop.dataset.sidePanelBound =
                "true";

            backdrop.addEventListener(
                "click",
                function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    closeSidePanel();
                }
            );
        }

        queryAll(
            "[data-side-panel] a[data-section]"
        ).forEach(
            function (link) {
                if (
                    link.dataset.sidePanelSectionBound ===
                    "true"
                ) {
                    return;
                }

                link.dataset.sidePanelSectionBound =
                    "true";

                link.addEventListener(
                    "click",
                    function () {
                        if (
                            isMobile()
                        ) {
                            closeSidePanel();
                        }
                    }
                );
            }
        );

        syncSidePanel();
    }

    /* =======================================================
       STATE SUBSCRIPTION
    ======================================================= */

    function initializeStateSubscription() {
        if (
            APP.stateSubscription
        ) {
            return;
        }

        if (
            !State ||
            typeof State.subscribe !==
                "function"
        ) {
            return;
        }

        APP.stateSubscription =
            State.subscribe(
                function () {
                    updateNavigation();
                    syncSidePanel();
                }
            );
    }

    /* =======================================================
       FORMS
    ======================================================= */

    function initializeForms() {
        queryAll(
            "form[data-frontend-form]"
        ).forEach(
            function (form) {
                if (
                    form.dataset.frontendFormBound ===
                    "true"
                ) {
                    return;
                }

                form.dataset.frontendFormBound =
                    "true";

                form.addEventListener(
                    "submit",
                    function (event) {
                        if (
                            form.dataset.frontendForm ===
                            "native"
                        ) {
                            return;
                        }

                        event.preventDefault();

                        form.dispatchEvent(
                            new CustomEvent(
                                "cybernexus:formsubmit",
                                {
                                    bubbles:
                                        true,

                                    detail: {
                                        form:
                                            form,

                                        data:
                                            new FormData(
                                                form
                                            )
                                    }
                                }
                            )
                        );
                    }
                );
            }
        );
    }

    /* =======================================================
       KEYBOARD
    ======================================================= */

    function initializeNavigationKeys() {
        if (
            APP.keyboardInitialized
        ) {
            return;
        }

        APP.keyboardInitialized =
            true;

        document.addEventListener(
            "keydown",
            function (event) {
                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }

                const panelState =
                    getSidePanelState();

                if (
                    panelState.open
                ) {
                    closeSidePanel();
                    return;
                }

                /*
                 * Let the component that owns a modal
                 * decide how its state should be closed.
                 */
                const modal =
                    query(
                        "[data-modal].is-open"
                    );

                if (modal) {
                    modal.dispatchEvent(
                        new CustomEvent(
                            "cybernexus:modal-close",
                            {
                                bubbles:
                                    true,

                                detail: {
                                    source:
                                        "keyboard"
                                }
                            }
                        )
                    );
                }
            }
        );
    }

    /* =======================================================
       EXTERNAL LINKS
    ======================================================= */

    function initializeExternalLinks() {
        queryAll(
            'a[target="_blank"]'
        ).forEach(
            function (link) {
                const current =
                    link.getAttribute(
                        "rel"
                    ) || "";

                const tokens =
                    current
                        .split(/\s+/)
                        .filter(Boolean);

                if (
                    !tokens.includes(
                        "noopener"
                    )
                ) {
                    tokens.push(
                        "noopener"
                    );
                }

                if (
                    !tokens.includes(
                        "noreferrer"
                    )
                ) {
                    tokens.push(
                        "noreferrer"
                    );
                }

                link.setAttribute(
                    "rel",
                    tokens.join(" ")
                );
            }
        );
    }

    /* =======================================================
       RESPONSIVE EVENTS
    ======================================================= */

    function initializeResponsiveEvents() {
        if (
            APP.responsiveInitialized
        ) {
            return;
        }

        APP.responsiveInitialized =
            true;

        let resizeFrame =
            null;

        function scheduleSync() {
            if (
                resizeFrame !== null
            ) {
                return;
            }

            const run =
                function () {
                    resizeFrame =
                        null;

                    syncSidePanel();
                };

            if (
                typeof window.requestAnimationFrame ===
                "function"
            ) {
                resizeFrame =
                    window.requestAnimationFrame(
                        run
                    );
            } else {
                resizeFrame =
                    window.setTimeout(
                        run,
                        0
                    );
            }
        }

        window.addEventListener(
            "resize",
            scheduleSync,
            {
                passive:
                    true
            }
        );

        window.addEventListener(
            "orientationchange",
            scheduleSync,
            {
                passive:
                    true
            }
        );
    }

    /* =======================================================
       READY STATE
    ======================================================= */

    function setReady() {
        if (
            APP.initialized
        ) {
            return;
        }

        APP.initialized =
            true;

        if (
            State &&
            typeof State.setInitialized ===
                "function"
        ) {
            State.setInitialized(
                true,
                "web-app-ready"
            );
        }

        if (
            State &&
            typeof State.setReady ===
                "function"
        ) {
            State.setReady(
                true,
                "web-app-ready"
            );
        }

        document.documentElement.classList.add(
            "cn-app-ready"
        );

        emit(
            "cybernexus:ready",
            {
                page:
                    getPageName()
            }
        );
    }

    /* =======================================================
       AUTHENTICATION
    ======================================================= */

    async function initializeAuthentication() {
        if (!Auth) {
            return false;
        }

        try {
            if (
                typeof Auth.initialize ===
                "function"
            ) {
                await Promise.resolve(
                    Auth.initialize()
                );
            }

            /*
             * The backend session remains the
             * authentication authority.
             */
            if (
                typeof Auth.verifySession ===
                "function"
            ) {
                return Boolean(
                    await Auth.verifySession()
                );
            }

            if (
                typeof Auth.isAuthenticated ===
                "function"
            ) {
                return Boolean(
                    Auth.isAuthenticated()
                );
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    /* =======================================================
       ACCOUNT
    ======================================================= */

    async function initializeAccount(
        authenticated
    ) {
        if (
            !Account ||
            typeof Account.initialize !==
                "function"
        ) {
            return null;
        }

        if (!authenticated) {
            return null;
        }

        try {
            return await Account.initialize();
        } catch (error) {
            /*
             * Account initialization failure must
             * not prevent public frontend pages
             * from becoming ready.
             */
            return null;
        }
    }

    /* =======================================================
       APPLICATION INITIALIZATION
    ======================================================= */

    async function initialize() {
        if (
            APP.initialized
        ) {
            return;
        }

        setCurrentPage();

        initializeNavigation();
        initializeSidePanel();
        initializeStateSubscription();
        initializeForms();
        initializeNavigationKeys();
        initializeExternalLinks();
        initializeResponsiveEvents();

        syncSidePanel();
        updateNavigation();

        const authenticated =
            await initializeAuthentication();

        await initializeAccount(
            authenticated
        );

        setReady();
    }

    /* =======================================================
       EVENTS
    ======================================================= */

    function on(
        eventName,
        callback
    ) {
        if (
            typeof eventName !==
                "string" ||
            !eventName.trim() ||
            typeof callback !==
                "function"
        ) {
            return function () {};
        }

        const name =
            eventName.trim();

        const handler =
            function (event) {
                callback(event);
            };

        document.addEventListener(
            name,
            handler
        );

        APP.listeners.push({
            eventName:
                name,

            callback:
                callback,

            handler:
                handler
        });

        return function () {
            document.removeEventListener(
                name,
                handler
            );

            const index =
                APP.listeners.findIndex(
                    function (item) {
                        return (
                            item.eventName ===
                                name &&
                            item.handler ===
                                handler
                        );
                    }
                );

            if (
                index !== -1
            ) {
                APP.listeners.splice(
                    index,
                    1
                );
            }
        };
    }

    function emit(
        eventName,
        detail
    ) {
        if (
            typeof eventName !==
                "string" ||
            !eventName.trim()
        ) {
            return;
        }

        document.dispatchEvent(
            new CustomEvent(
                eventName.trim(),
                {
                    detail:
                        detail &&
                        typeof detail ===
                            "object"
                            ? detail
                            : {}
                }
            )
        );
    }

    /* =======================================================
       PUBLIC API
    ======================================================= */

    const WebApp =
        Object.freeze({
            initialize,

            isInitialized:
                function () {
                    return APP.initialized;
                },

            on,
            emit,

            getPageName,

            updateNavigation,

            getSidePanelState,
            syncSidePanel,
            openSidePanel,
            closeSidePanel,
            toggleSidePanel
        });

    /* =======================================================
       GLOBAL EXPORT
    ======================================================= */

    CyberNexus.WebApp =
        WebApp;

    window.CyberNexusWebApp =
        WebApp;

    /* =======================================================
       START APPLICATION
    ======================================================= */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once:
                    true
            }
        );
    } else {
        initialize();
    }

})(window, document);
