/* ==========================================================================
   CyberNexus IT Portfolio Platform
   File: frontend/js/web-app.js

   Responsibility:
   - Main frontend application lifecycle
   - Page navigation synchronization
   - Section navigation synchronization
   - Side-panel behavior
   - Frontend form interception
   - Resume button behavior
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

    /* ==========================================================================
       NAMESPACE
       ========================================================================== */

    const CyberNexus =
        (window.CyberNexus =
            window.CyberNexus || {});

    /* ==========================================================================
       DEPENDENCIES
       ========================================================================== */

    const State =
        CyberNexus.State ||
        window.CyberNexusState;

    const Auth =
        CyberNexus.Auth ||
        window.CyberNexusAuth;

    const Account =
        CyberNexus.Account ||
        window.CyberNexusAccount;

    /* ==========================================================================
       APPLICATION STATE
       ========================================================================== */

    const APP = {
        initialized: false,

        listeners: [],

        stateSubscription: null,

        responsiveInitialized: false,

        keyboardInitialized: false
    };

    /* ==========================================================================
       DOM HELPERS
       ========================================================================== */

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

    /* ==========================================================================
       PAGE
       ========================================================================== */

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
            !State ||
            typeof State.setPage !==
                "function"
        ) {
            return;
        }

        const currentSection =
            State &&
            typeof State.getCurrentSection ===
                "function"
                ? State.getCurrentSection()
                : "";

        /*
         * State.setPage(page, options)
         *
         * The section belongs inside the
         * options object.
         */
        State.setPage(
            getPageName(),
            {
                section:
                    currentSection
            }
        );
    }

    /* ==========================================================================
       PAGE NAVIGATION
       ========================================================================== */

    function getPageNavigationLinks() {
        return queryAll(
            "a[data-page][href]"
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
                         * focusable and accessible.
                         *
                         * Only prevent an unnecessary
                         * reload of the same page.
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
                                {
                                    section:
                                        ""
                                }
                            );
                        }

                        /*
                         * Allow the browser to follow
                         * the actual page URL.
                         */
                        if (
                            isMobile()
                        ) {
                            closeSidePanel();
                        }
                    }
                );
            }
        );

        updateNavigation();
    }

    /* ==========================================================================
       SECTION NAVIGATION
       ========================================================================== */

    function getSectionNavigationLinks() {
        return queryAll(
            "a[data-section-link][href]"
        );
    }

    function getSectionFromLink(
        link
    ) {
        if (!link) {
            return "";
        }

        const configured =
            link.dataset.sectionLink;

        if (
            typeof configured ===
                "string" &&
            configured.trim()
        ) {
            return configured
                .trim()
                .replace(/^#/, "");
        }

        const href =
            link.getAttribute(
                "href"
            );

        if (
            typeof href ===
                "string" &&
            href.includes("#")
        ) {
            return href
                .split("#")
                .pop()
                .trim();
        }

        return "";
    }

    function updateSectionNavigation() {
        const currentSection =
            State &&
            typeof State.getCurrentSection ===
                "function"
                ? State.getCurrentSection()
                : "";

        getSectionNavigationLinks().forEach(
            function (link) {
                const section =
                    getSectionFromLink(
                        link
                    );

                const current =
                    section ===
                    currentSection;

                link.classList.toggle(
                    "is-current",
                    current
                );

                if (current) {
                    link.setAttribute(
                        "aria-current",
                        "location"
                    );
                } else {
                    link.removeAttribute(
                        "aria-current"
                    );
                }
            }
        );
    }

    function initializeSectionNavigation() {
        getSectionNavigationLinks().forEach(
            function (link) {
                if (
                    link.dataset.sectionBound ===
                    "true"
                ) {
                    return;
                }

                link.dataset.sectionBound =
                    "true";

                link.addEventListener(
                    "click",
                    function () {
                        const section =
                            getSectionFromLink(
                                link
                            );

                        if (
                            State &&
                            typeof State.setSection ===
                                "function" &&
                            section
                        ) {
                            State.setSection(
                                section
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

        updateSectionNavigation();
    }

    /* ==========================================================================
       RESPONSIVE
       ========================================================================== */

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

    /* ==========================================================================
       SIDE PANEL STATE
       ========================================================================== */

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
            State.openSidePanel();
        } else if (
            State &&
            typeof State.setSidePanelOpen ===
                "function"
        ) {
            State.setSidePanelOpen(true);
        }

        syncSidePanel();
    }

    function closeSidePanel() {
        if (
            State &&
            typeof State.closeSidePanel ===
                "function"
        ) {
            State.closeSidePanel();
        } else if (
            State &&
            typeof State.setSidePanelOpen ===
                "function"
        ) {
            State.setSidePanelOpen(false);
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

    function collapseSidePanel() {
        if (!State) {
            return;
        }

        if (
            typeof State.collapseSidePanel ===
            "function"
        ) {
            State.collapseSidePanel();
        } else if (
            typeof State.setSidePanelCollapsed ===
            "function"
        ) {
            State.setSidePanelCollapsed(
                true
            );
        }

        syncSidePanel();
    }

    function restoreSidePanel() {
        if (!State) {
            return;
        }

        if (
            typeof State.restoreSidePanel ===
            "function"
        ) {
            State.restoreSidePanel();
        } else if (
            typeof State.expandSidePanel ===
            "function"
        ) {
            State.expandSidePanel();
        } else if (
            typeof State.setSidePanelCollapsed ===
            "function"
        ) {
            State.setSidePanelCollapsed(
                false
            );
        }

        syncSidePanel();
    }

    /* ==========================================================================
       SIDE PANEL DOM
       ========================================================================== */

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
                    !open ||
                    !collapsed;
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

    /* ==========================================================================
       SIDE PANEL INITIALIZATION
       ========================================================================== */

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

                        collapseSidePanel();
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

                        restoreSidePanel();
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

        syncSidePanel();
    }

    /* ==========================================================================
       STATE SUBSCRIPTION
       ========================================================================== */

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

                    updateSectionNavigation();

                    syncSidePanel();
                }
            );
    }

    /* ==========================================================================
       FORMS
       ========================================================================== */

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

    /* ==========================================================================
       RESUME BUTTONS
       ========================================================================== */

    function initializeResumeButtons() {
        queryAll(
            '[data-action="resume-view"], [data-action="resume-download"]'
        ).forEach(
            function (button) {
                if (
                    button.dataset.resumeBound ===
                    "true"
                ) {
                    return;
                }

                button.dataset.resumeBound =
                    "true";

                button.setAttribute(
                    "type",
                    "button"
                );

                button.addEventListener(
                    "click",
                    function (event) {
                        event.preventDefault();

                        alert(
                            "Resume not yet available."
                        );
                    }
                );
            }
        );
    }

    /* ==========================================================================
       KEYBOARD
       ========================================================================== */

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

    /* ==========================================================================
       EXTERNAL LINKS
       ========================================================================== */

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

    /* ==========================================================================
       RESPONSIVE EVENTS
       ========================================================================== */

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

    /* ==========================================================================
       AUTHENTICATION
       ========================================================================== */

    async function initializeAuthentication() {
        if (!Auth) {
            return false;
        }

        try {
            if (
                typeof Auth.initialize ===
                "function"
            ) {
                await Auth.initialize();
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

    /* ==========================================================================
       ACCOUNT
       ========================================================================== */

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
             * not block public pages.
             */
            return null;
        }
    }

    /* ==========================================================================
       READY STATE
       ========================================================================== */

    function setReady() {
        if (
            APP.initialized
        ) {
            return;
        }

        APP.initialized =
            true;

        /*
         * Use the state methods only when they
         * exist so web-app.js remains compatible
         * with the state module.
         */
        if (
            State &&
            typeof State.setInitialized ===
                "function"
        ) {
            State.setInitialized(
                true
            );
        }

        if (
            State &&
            typeof State.setReady ===
                "function"
        ) {
            State.setReady(
                true
            );
        }

        document.documentElement.classList.add(
            "cn-app-ready"
        );

        emit(
            "cybernexus:ready",
            {
                page:
                    getPageName(),

                authenticated:
                    Auth &&
                    typeof Auth.isAuthenticated ===
                        "function"
                        ? Auth.isAuthenticated()
                        : false
            }
        );
    }

    /* ==========================================================================
       APPLICATION INITIALIZATION
       ========================================================================== */

    async function initialize() {
        if (
            APP.initialized
        ) {
            return;
        }

        /*
         * Establish the current page first.
         */
        setCurrentPage();

        /*
         * Bind frontend behavior.
         */
        initializeNavigation();

        initializeSectionNavigation();

        initializeSidePanel();

        initializeStateSubscription();

        initializeForms();

        initializeResumeButtons();

        initializeNavigationKeys();

        initializeExternalLinks();

        initializeResponsiveEvents();

        /*
         * Synchronize the initial DOM.
         */
        syncSidePanel();

        updateNavigation();

        updateSectionNavigation();

        /*
         * Authentication and account state
         * initialize after the frontend controls.
         */
        const authenticated =
            await initializeAuthentication();

        await initializeAccount(
            authenticated
        );

        setReady();
    }

    /* ==========================================================================
       EVENTS
       ========================================================================== */

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

            callback,

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

    /* ==========================================================================
       PUBLIC API
       ========================================================================== */

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

            updateSectionNavigation,

            getSidePanelState,

            syncSidePanel,

            openSidePanel,

            closeSidePanel,

            toggleSidePanel,

            collapseSidePanel,

            restoreSidePanel
        });

    /* ==========================================================================
       GLOBAL EXPORT
       ========================================================================== */

    CyberNexus.WebApp =
        WebApp;

    window.CyberNexusWebApp =
        WebApp;

    /* ==========================================================================
       START APPLICATION
       ========================================================================== */

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
