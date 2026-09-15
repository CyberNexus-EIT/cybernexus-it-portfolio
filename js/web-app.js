/*
 * CyberNexus IT Portfolio Platform
 * File: frontend/js/web-app.js
 *
 * Responsibility:
 * - Main frontend application lifecycle
 * - Page navigation synchronization
 * - Section navigation synchronization
 * - Side-panel behavior
 * - Frontend form interception
 * - Contact form lifecycle
 * - Resume button behavior
 * - Keyboard interaction
 * - External-link safety
 * - Responsive synchronization
 * - Authentication/account initialization
 * - DOM/UI coordination
 *
 * Does NOT own:
 * - Persistent application state
 * - HTTP transport
 * - API path construction
 * - Authentication implementation
 * - Account implementation
 * - Chat/voice implementation
 * - CSS presentation
 */

(function (window, document) {
    "use strict";

    /* =========================================================
       NAMESPACE
       ========================================================= */

    const CyberNexus =
        (window.CyberNexus =
            window.CyberNexus || {});

    /* =========================================================
       DEPENDENCIES
       ========================================================= */

    const State =
        CyberNexus.State ||
        window.CyberNexusState ||
        null;

    const Auth =
        CyberNexus.Auth ||
        window.CyberNexusAuth ||
        null;

    const Account =
        CyberNexus.Account ||
        window.CyberNexusAccount ||
        null;

    const Api =
        CyberNexus.Api ||
        window.CyberNexusApi ||
        null;

    /* =========================================================
       APPLICATION CONFIGURATION
       ========================================================= */

    const CONFIG = Object.freeze({
        mobileBreakpoint:
            767,

        defaultResumePath:
            "assets/Mark_Pangilinan_Resume.pdf",

        contactStatusSelector:
            "[data-contact-status], [data-form-status]"
    });

    /* =========================================================
       APPLICATION STATE
       ========================================================= */

    const APP = {
        initialized:
            false,

        initializing:
            false,

        stateSubscription:
            null,

        authSubscription:
            null,

        accountSubscription:
            null,

        responsiveInitialized:
            false,

        keyboardInitialized:
            false,

        contactForms:
            new WeakSet(),

        contactSubmitting:
            new WeakSet(),

        boundPageLinks:
            new WeakSet(),

        boundSectionLinks:
            new WeakSet(),

        boundSidePanelControls:
            new WeakSet(),

        boundForms:
            new WeakSet(),

        boundResumeControls:
            new WeakSet(),

        boundExternalLinks:
            new WeakSet(),

        resizeFrame:
            null
    };

    /* =========================================================
       DEPENDENCY VALIDATION
       ========================================================= */

    function validateDependencies() {
        if (!State) {
            console.warn(
                "CyberNexus.State is not available."
            );
        }

        if (!Auth) {
            console.warn(
                "CyberNexus.Auth is not available."
            );
        }

        if (!Account) {
            console.warn(
                "CyberNexus.Account is not available."
            );
        }

        if (!Api) {
            console.warn(
                "CyberNexus.Api is not available."
            );
        }
    }

    /* =========================================================
       DOM HELPERS
       ========================================================= */

    function query(
        selector,
        root
    ) {
        return (
            root || document
        ).querySelector(
            selector
        );
    }

    function queryAll(
        selector,
        root
    ) {
        return Array.from(
            (
                root || document
            ).querySelectorAll(
                selector
            )
        );
    }

    function isElement(
        value
    ) {
        return (
            value instanceof
            Element
        );
    }

    /* =========================================================
       GENERAL HELPERS
       ========================================================= */

    function normalizeString(
        value
    ) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(
            value
        ).trim();
    }

    function getFormValue(
        form,
        name
    ) {
        if (
            !form ||
            !name
        ) {
            return "";
        }

        const field =
            form.elements.namedItem(
                name
            );

        if (
            !field ||
            typeof field.value !==
                "string"
        ) {
            return "";
        }

        return normalizeString(
            field.value
        );
    }

    function getErrorMessage(
        error
    ) {
        const fallback =
            "Something went wrong. Please try again.";

        if (!error) {
            return fallback;
        }

        if (
            typeof error ===
            "string"
        ) {
            return (
                normalizeString(
                    error
                ) || fallback
            );
        }

        if (
            typeof error.message ===
            "string"
        ) {
            return (
                normalizeString(
                    error.message
                ) || fallback
            );
        }

        if (
            error.data &&
            typeof error.data ===
                "object"
        ) {
            if (
                typeof error.data.message ===
                "string"
            ) {
                return (
                    normalizeString(
                        error.data.message
                    ) || fallback
                );
            }

            if (
                typeof error.data.error ===
                "string"
            ) {
                return (
                    normalizeString(
                        error.data.error
                    ) || fallback
                );
            }
        }

        if (
            error.response &&
            typeof error.response ===
                "object"
        ) {
            if (
                typeof error.response.message ===
                "string"
            ) {
                return (
                    normalizeString(
                        error.response.message
                    ) || fallback
                );
            }

            if (
                typeof error.response.error ===
                "string"
            ) {
                return (
                    normalizeString(
                        error.response.error
                    ) || fallback
                );
            }

            if (
                error.response.data &&
                typeof error.response.data ===
                    "object"
            ) {
                if (
                    typeof error.response.data.message ===
                    "string"
                ) {
                    return (
                        normalizeString(
                            error.response.data.message
                        ) || fallback
                    );
                }

                if (
                    typeof error.response.data.error ===
                    "string"
                ) {
                    return (
                        normalizeString(
                            error.response.data.error
                        ) || fallback
                    );
                }
            }
        }

        if (
            typeof error.error ===
            "string"
        ) {
            return (
                normalizeString(
                    error.error
                ) || fallback
            );
        }

        return fallback;
    }

    function emit(
        eventName,
        detail
    ) {
        const name =
            normalizeString(
                eventName
            );

        if (!name) {
            return;
        }

        document.dispatchEvent(
            new CustomEvent(
                name,
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

    function on(
        eventName,
        callback
    ) {
        const name =
            normalizeString(
                eventName
            );

        if (
            !name ||
            typeof callback !==
                "function"
        ) {
            return function () {};
        }

        document.addEventListener(
            name,
            callback
        );

        return function unsubscribe() {
            document.removeEventListener(
                name,
                callback
            );
        };
    }

    /* =========================================================
       PAGE
       ========================================================= */

    function getPageName() {
        const pathname =
            window.location.pathname
                .replace(
                    /\/+$/,
                    ""
                );

        const filename =
            pathname
                .split("/")
                .pop()
                .toLowerCase();

        const pages = {
            "":
                "portfolio",

            "index.html":
                "portfolio",

            "portfolio.html":
                "portfolio",

            "projects.html":
                "projects",

            "skills.html":
                "skills",

            "experience.html":
                "experience",

            "contact.html":
                "contact",

            "privacy.html":
                "privacy",

            "terms.html":
                "terms"
        };

        return (
            pages[filename] ||
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

        const section =
            State &&
            typeof State.getCurrentSection ===
                "function"
                ? normalizeString(
                      State.getCurrentSection()
                  )
                : "";

        State.setPage(
            getPageName(),
            {
                section
            }
        );
    }

    function getCurrentPage() {
        if (
            State &&
            typeof State.getCurrentPage ===
                "function"
        ) {
            const page =
                normalizeString(
                    State.getCurrentPage()
                ).toLowerCase();

            if (page) {
                return page;
            }
        }

        return getPageName();
    }

    /* =========================================================
       PAGE NAVIGATION
       ========================================================= */

    function getPageNavigationLinks() {
        return queryAll(
            "a[data-page][href]"
        );
    }

    function updateNavigation() {
        const currentPage =
            getCurrentPage();

        getPageNavigationLinks()
            .forEach(
                function (link) {
                    const page =
                        normalizeString(
                            link.dataset.page
                        ).toLowerCase();

                    const current =
                        Boolean(
                            page &&
                            page ===
                                currentPage
                        );

                    link.classList.toggle(
                        "is-current",
                        current
                    );

                    link.classList.toggle(
                        "is-active",
                        current
                    );

                    link.dataset.current =
                        String(
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
        getPageNavigationLinks()
            .forEach(
                function (link) {
                    if (
                        APP.boundPageLinks.has(
                            link
                        )
                    ) {
                        return;
                    }

                    APP.boundPageLinks.add(
                        link
                    );

                    link.addEventListener(
                        "click",
                        function (event) {
                            const page =
                                normalizeString(
                                    link.dataset.page
                                ).toLowerCase();

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
                                getCurrentPage();

                            if (
                                page ===
                                    currentPage &&
                                !href.includes(
                                    "#"
                                )
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

    /* =========================================================
       SECTION NAVIGATION
       ========================================================= */

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
            normalizeString(
                link.dataset.sectionLink
            );

        if (configured) {
            return configured.replace(
                /^#/,
                ""
            );
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
            return normalizeString(
                href
                    .split("#")
                    .pop()
            );
        }

        return "";
    }

    function getCurrentSection() {
        if (
            State &&
            typeof State.getCurrentSection ===
                "function"
        ) {
            return normalizeString(
                State.getCurrentSection()
            );
        }

        return normalizeString(
            window.location.hash
                .replace(
                    /^#/,
                    ""
                )
        );
    }

    function updateSectionNavigation() {
        const currentSection =
            getCurrentSection();

        getSectionNavigationLinks()
            .forEach(
                function (link) {
                    const section =
                        getSectionFromLink(
                            link
                        );

                    const current =
                        Boolean(
                            section &&
                            section ===
                                currentSection
                        );

                    link.classList.toggle(
                        "is-current",
                        current
                    );

                    link.classList.toggle(
                        "is-active",
                        current
                    );

                    link.dataset.current =
                        String(
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
        getSectionNavigationLinks()
            .forEach(
                function (link) {
                    if (
                        APP.boundSectionLinks.has(
                            link
                        )
                    ) {
                        return;
                    }

                    APP.boundSectionLinks.add(
                        link
                    );

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

    /* =========================================================
       RESPONSIVE
       ========================================================= */

    function isMobile() {
        if (
            typeof window.matchMedia !==
            "function"
        ) {
            return false;
        }

        return window.matchMedia(
            `(max-width: ${CONFIG.mobileBreakpoint}px)`
        ).matches;
    }

    /* =========================================================
       SIDE PANEL STATE
       ========================================================= */

    function getSidePanelState() {
        if (
            State &&
            typeof State.getSidePanelState ===
                "function"
        ) {
            const state =
                State.getSidePanelState();

            if (
                state &&
                typeof state ===
                    "object"
            ) {
                return {
                    open:
                        Boolean(
                            state.open
                        ),

                    collapsed:
                        Boolean(
                            state.collapsed
                        )
                };
            }
        }

        return {
            open: false,
            collapsed: false
        };
    }

    /* =========================================================
       SIDE PANEL ACTIONS
       ========================================================= */

    function openSidePanel() {
        if (!State) {
            return;
        }

        if (
            typeof State.openSidePanel ===
            "function"
        ) {
            State.openSidePanel();
        } else if (
            typeof State.setSidePanelOpen ===
            "function"
        ) {
            State.setSidePanelOpen(
                true
            );
        }

        syncSidePanel();
    }

    function closeSidePanel() {
        if (!State) {
            return;
        }

        if (
            typeof State.closeSidePanel ===
            "function"
        ) {
            State.closeSidePanel();
        } else if (
            typeof State.setSidePanelOpen ===
            "function"
        ) {
            State.setSidePanelOpen(
                false
            );
        }

        syncSidePanel();
    }

    function toggleSidePanel() {
        const state =
            getSidePanelState();

        if (state.open) {
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

    /* =========================================================
       SIDE PANEL SYNCHRONIZATION
       ========================================================= */

    function syncSidePanel() {
        const panel =
            query(
                "[data-side-panel]"
            );

        const state =
            getSidePanelState();

        const open =
            Boolean(
                state.open
            );

        const collapsed =
            Boolean(
                state.collapsed
            );

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

            panel.dataset.open =
                String(
                    open
                );

            panel.dataset.collapsed =
                String(
                    collapsed
                );

            panel.setAttribute(
                "aria-hidden",
                String(
                    !open
                )
            );
        }

        queryAll(
            "[data-side-panel-toggle]"
        ).forEach(
            function (button) {
                button.type =
                    "button";

                button.setAttribute(
                    "aria-expanded",
                    String(
                        open
                    )
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
                button.type =
                    "button";

                button.setAttribute(
                    "aria-expanded",
                    String(
                        open
                    )
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
                button.type =
                    "button";

                button.setAttribute(
                    "aria-expanded",
                    String(
                        open
                    )
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
                button.type =
                    "button";

                button.setAttribute(
                    "aria-expanded",
                    String(
                        !collapsed
                    )
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
                button.type =
                    "button";

                button.setAttribute(
                    "aria-expanded",
                    String(
                        !collapsed
                    )
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

            backdrop.hidden =
                !open;

            backdrop.setAttribute(
                "aria-hidden",
                String(
                    !open
                )
            );
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

        const mobileOpen =
            isMobile() &&
            open;

        document.documentElement.classList.toggle(
            "side-panel-lock",
            mobileOpen
        );

        document.body.classList.toggle(
            "side-panel-lock",
            mobileOpen
        );
    }

    /* =========================================================
       SIDE PANEL INITIALIZATION
       ========================================================= */

    function bindSidePanelControl(
        selector,
        callback
    ) {
        queryAll(
            selector
        ).forEach(
            function (button) {
                if (
                    APP.boundSidePanelControls.has(
                        button
                    )
                ) {
                    return;
                }

                APP.boundSidePanelControls.add(
                    button
                );

                button.type =
                    "button";

                button.addEventListener(
                    "click",
                    function (event) {
                        event.preventDefault();
                        event.stopPropagation();

                        callback();
                    }
                );
            }
        );
    }

    function initializeSidePanel() {
        bindSidePanelControl(
            "[data-side-panel-toggle]",
            toggleSidePanel
        );

        bindSidePanelControl(
            "[data-side-panel-open]",
            openSidePanel
        );

        bindSidePanelControl(
            "[data-side-panel-close]",
            closeSidePanel
        );

        bindSidePanelControl(
            "[data-side-panel-collapse]",
            collapseSidePanel
        );

        bindSidePanelControl(
            "[data-side-panel-restore]",
            restoreSidePanel
        );

        const backdrop =
            query(
                "[data-side-panel-backdrop]"
            );

        if (
            backdrop &&
            !APP.boundSidePanelControls.has(
                backdrop
            )
        ) {
            APP.boundSidePanelControls.add(
                backdrop
            );

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

    /* =========================================================
       STATE SUBSCRIPTION
       ========================================================= */

    function initializeStateSubscription() {
        if (
            APP.stateSubscription ||
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

    /* =========================================================
       AUTH SUBSCRIPTION
       ========================================================= */

    function initializeAuthSubscription() {
        if (
            APP.authSubscription ||
            !Auth ||
            typeof Auth.subscribe !==
                "function"
        ) {
            return;
        }

        APP.authSubscription =
            Auth.subscribe(
                function (
                    snapshot
                ) {
                    emit(
                        "cybernexus:auth-state",
                        {
                            snapshot
                        }
                    );
                }
            );
    }

    /* =========================================================
       ACCOUNT SUBSCRIPTION
       ========================================================= */

    function initializeAccountSubscription() {
        if (
            APP.accountSubscription ||
            !Account ||
            typeof Account.subscribe !==
                "function"
        ) {
            return;
        }

        APP.accountSubscription =
            Account.subscribe(
                function (
                    snapshot
                ) {
                    emit(
                        "cybernexus:account-state",
                        {
                            snapshot
                        }
                    );
                }
            );
    }

    /* =========================================================
       FORM STATUS
       ========================================================= */

    function getFormStatusElement(
        form
    ) {
        if (!form) {
            return null;
        }

        return query(
            CONFIG.contactStatusSelector,
            form
        );
    }

    function setFormStatus(
        form,
        message,
        type
    ) {
        const status =
            getFormStatusElement(
                form
            );

        if (!status) {
            return;
        }

        const text =
            normalizeString(
                message
            );

        status.hidden =
            !text;

        status.textContent =
            text;

        status.dataset.status =
            type || "";

        status.classList.toggle(
            "is-success",
            type === "success"
        );

        status.classList.toggle(
            "is-error",
            type === "error"
        );

        status.classList.toggle(
            "is-loading",
            type === "loading"
        );

        status.setAttribute(
            "aria-live",
            "polite"
        );
    }

    function clearFormStatus(
        form
    ) {
        setFormStatus(
            form,
            "",
            ""
        );
    }

    /* =========================================================
       FORM BUSY STATE
       ========================================================= */

    function setFormBusy(
        form,
        busy
    ) {
        if (!form) {
            return;
        }

        const isBusy =
            Boolean(
                busy
            );

        form.setAttribute(
            "aria-busy",
            String(
                isBusy
            )
        );

        form.classList.toggle(
            "is-submitting",
            isBusy
        );

        queryAll(
            "button, input, textarea, select",
            form
        ).forEach(
            function (control) {
                if (isBusy) {
                    if (
                        control.dataset
                            .previousDisabled ===
                        undefined
                    ) {
                        control.dataset.previousDisabled =
                            String(
                                control.disabled
                            );
                    }

                    control.disabled =
                        true;

                    return;
                }

                const previous =
                    control.dataset
                        .previousDisabled;

                if (
                    previous !==
                    undefined
                ) {
                    control.disabled =
                        previous ===
                        "true";

                    delete control
                        .dataset
                        .previousDisabled;
                }
            }
        );
    }

    /* =========================================================
       CONTACT VALIDATION
       ========================================================= */

    function validateContactForm(
        form
    ) {
        if (!form) {
            return {
                valid: false,

                message:
                    "The contact form is unavailable."
            };
        }

        const name =
            getFormValue(
                form,
                "name"
            );

        const email =
            getFormValue(
                form,
                "email"
            );

        const subject =
            getFormValue(
                form,
                "subject"
            );

        const message =
            getFormValue(
                form,
                "message"
            );

        if (
            name.length < 2
        ) {
            return {
                valid: false,

                message:
                    "Please enter your name."
            };
        }

        if (
            name.length > 100
        ) {
            return {
                valid: false,

                message:
                    "Your name is too long."
            };
        }

        if (!email) {
            return {
                valid: false,

                message:
                    "Please enter your email address."
            };
        }

        if (
            email.length > 254
        ) {
            return {
                valid: false,

                message:
                    "Your email address is too long."
            };
        }

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
            !emailPattern.test(
                email
            )
        ) {
            return {
                valid: false,

                message:
                    "Please enter a valid email address."
            };
        }

        if (
            subject.length < 3
        ) {
            return {
                valid: false,

                message:
                    "Please enter a subject."
            };
        }

        if (
            subject.length > 200
        ) {
            return {
                valid: false,

                message:
                    "Your subject is too long."
            };
        }

        if (
            message.length < 10
        ) {
            return {
                valid: false,

                message:
                    "Please enter a message."
            };
        }

        if (
            message.length > 5000
        ) {
            return {
                valid: false,

                message:
                    "Your message is too long."
            };
        }

        return {
            valid: true,

            data: {
                name,
                email,
                subject,
                message
            }
        };
    }

    /* =========================================================
       CONTACT RESPONSE
       ========================================================= */

    function getResponseData(
        response
    ) {
        if (
            response &&
            response.data &&
            typeof response.data ===
                "object"
        ) {
            return response.data;
        }

        if (
            response &&
            typeof response ===
                "object"
        ) {
            return response;
        }

        return {};
    }

    function isSuccessfulResponse(
        response
    ) {
        if (!response) {
            return false;
        }

        if (
            typeof response.ok ===
            "boolean" &&
            !response.ok
        ) {
            return false;
        }

        const data =
            getResponseData(
                response
            );

        if (
            data &&
            data.success ===
            false
        ) {
            return false;
        }

        return true;
    }

    /* =========================================================
       CONTACT API
       ========================================================= */

    async function submitContactRequest(
        data
    ) {
        if (
            !Api ||
            typeof Api.submitContact !==
                "function"
        ) {
            throw new Error(
                "The contact API method is not configured."
            );
        }

        return Api.submitContact(
            data
        );
    }

    /* =========================================================
       CONTACT SUBMISSION
       ========================================================= */

    async function handleContactFormSubmit(
        form
    ) {
        if (!form) {
            return;
        }

        if (
            APP.contactSubmitting.has(
                form
            )
        ) {
            return;
        }

        const validation =
            validateContactForm(
                form
            );

        if (
            !validation.valid
        ) {
            setFormStatus(
                form,
                validation.message,
                "error"
            );

            return;
        }

        APP.contactSubmitting.add(
            form
        );

        setFormBusy(
            form,
            true
        );

        setFormStatus(
            form,
            "Sending your message...",
            "loading"
        );

        try {
            const response =
                await submitContactRequest(
                    validation.data
                );

            if (
                !isSuccessfulResponse(
                    response
                )
            ) {
                throw new Error(
                    getErrorMessage(
                        response
                    )
                );
            }

            form.reset();

            setFormStatus(
                form,
                "Your message was sent successfully.",
                "success"
            );

            emit(
                "cybernexus:contact:success",
                {
                    form,
                    response
                }
            );
        } catch (error) {
            setFormStatus(
                form,
                getErrorMessage(
                    error
                ),
                "error"
            );

            emit(
                "cybernexus:contact:error",
                {
                    form,
                    error
                }
            );
        } finally {
            APP.contactSubmitting.delete(
                form
            );

            setFormBusy(
                form,
                false
            );
        }
    }

    /* =========================================================
       CONTACT FORM INITIALIZATION
       ========================================================= */

    function initializeContactForm(
        form
    ) {
        if (
            APP.contactForms.has(
                form
            )
        ) {
            return;
        }

        APP.contactForms.add(
            form
        );

        form.addEventListener(
            "input",
            function () {
                const status =
                    getFormStatusElement(
                        form
                    );

                if (
                    status &&
                    status.dataset.status ===
                        "error"
                ) {
                    clearFormStatus(
                        form
                    );
                }
            }
        );

        form.addEventListener(
            "reset",
            function () {
                window.setTimeout(
                    function () {
                        clearFormStatus(
                            form
                        );
                    },
                    0
                );
            }
        );
    }

    /* =========================================================
       FORM INITIALIZATION
       ========================================================= */

    function initializeForms() {
        queryAll(
            "form[data-frontend-form]"
        ).forEach(
            function (form) {
                if (
                    APP.boundForms.has(
                        form
                    )
                ) {
                    return;
                }

                APP.boundForms.add(
                    form
                );

                const type =
                    normalizeString(
                        form.dataset
                            .frontendForm
                    ).toLowerCase();

                if (
                    type ===
                    "contact"
                ) {
                    initializeContactForm(
                        form
                    );
                }

                form.addEventListener(
                    "submit",
                    function (event) {
                        if (
                            type ===
                            "native"
                        ) {
                            return;
                        }

                        event.preventDefault();

                        if (
                            type ===
                            "contact"
                        ) {
                            void handleContactFormSubmit(
                                form
                            );

                            return;
                        }

                        emit(
                            "cybernexus:formsubmit",
                            {
                                form,
                                type
                            }
                        );
                    }
                );
            }
        );
    }

    /* =========================================================
       RESUME
       ========================================================= */

    function getResumePath(
        control
    ) {
        if (!control) {
            return CONFIG.defaultResumePath;
        }

        const configured =
            normalizeString(
                control.dataset
                    .resumeUrl
            );

        if (configured) {
            return configured;
        }

        const href =
            normalizeString(
                control.getAttribute(
                    "href"
                )
            );

        if (
            href &&
            !href.startsWith(
                "#"
            ) &&
            !href.startsWith(
                "javascript:"
            )
        ) {
            return href;
        }

        return CONFIG.defaultResumePath;
    }

    function getFreshResumeUrl(
        path
    ) {
        const normalized =
            normalizeString(
                path
            );

        if (!normalized) {
            return "";
        }

        try {
            const url =
                new URL(
                    normalized,
                    window.location.href
                );

            /*
             * Cache-busting is intentionally
             * generated at runtime.
             *
             * This prevents an old browser/PDF
             * viewer cache from displaying an
             * outdated resume.
             */
            url.searchParams.set(
                "v",
                String(
                    Date.now()
                )
            );

            return url.href;
        } catch (
            error
        ) {
            return normalized;
        }
    }

    function openResume(
        control
    ) {
        const path =
            getResumePath(
                control
            );

        const url =
            getFreshResumeUrl(
                path
            );

        if (!url) {
            return;
        }

        emit(
            "cybernexus:resume-request",
            {
                action:
                    "resume-view",

                url
            }
        );

        const opened =
            window.open(
                url,
                "_blank",
                "noopener,noreferrer"
            );

        if (
            opened &&
            typeof opened.focus ===
                "function"
        ) {
            opened.focus();
        }
    }

    function downloadResume(
        control
    ) {
        const path =
            getResumePath(
                control
            );

        if (!path) {
            return;
        }

        emit(
            "cybernexus:resume-request",
            {
                action:
                    "resume-download",

                url:
                    path
            }
        );

        const link =
            document.createElement(
                "a"
            );

        link.href =
            path;

        link.download =
            "Mark_Pangilinan_Resume.pdf";

        link.rel =
            "noopener";

        link.style.display =
            "none";

        document.body.appendChild(
            link
        );

        link.click();

        link.remove();
    }

    function initializeResumeButtons() {
        queryAll(
            '[data-action="resume-view"], [data-action="resume-download"]'
        ).forEach(
            function (control) {
                if (
                    APP.boundResumeControls.has(
                        control
                    )
                ) {
                    return;
                }

                APP.boundResumeControls.add(
                    control
                );

                const action =
                    normalizeString(
                        control.dataset
                            .action
                    ).toLowerCase();

                /*
                 * Only force button type when
                 * the element is actually a
                 * button.
                 */
                if (
                    control instanceof
                    HTMLButtonElement
                ) {
                    control.type =
                        "button";
                }

                control.addEventListener(
                    "click",
                    function (event) {
                        if (
                            action ===
                            "resume-view"
                        ) {
                            event.preventDefault();

                            openResume(
                                control
                            );

                            return;
                        }

                        if (
                            action ===
                            "resume-download"
                        ) {
                            event.preventDefault();

                            downloadResume(
                                control
                            );
                        }
                    }
                );
            }
        );
    }

    /* =========================================================
       KEYBOARD
       ========================================================= */

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

                const state =
                    getSidePanelState();

                if (
                    state.open
                ) {
                    closeSidePanel();

                    return;
                }

                const modal =
                    query(
                        "[data-modal].is-open"
                    );

                if (modal) {
                    emit(
                        "cybernexus:modal-close",
                        {
                            source:
                                "keyboard",

                            modal
                        }
                    );
                }
            }
        );
    }

    /* =========================================================
       EXTERNAL LINKS
       ========================================================= */

    function initializeExternalLinks() {
        queryAll(
            'a[target="_blank"]'
        ).forEach(
            function (link) {
                if (
                    APP.boundExternalLinks.has(
                        link
                    )
                ) {
                    return;
                }

                APP.boundExternalLinks.add(
                    link
                );

                const rel =
                    new Set(
                        normalizeString(
                            link.getAttribute(
                                "rel"
                            )
                        )
                            .split(/\s+/)
                            .filter(
                                Boolean
                            )
                    );

                rel.add(
                    "noopener"
                );

                rel.add(
                    "noreferrer"
                );

                link.setAttribute(
                    "rel",
                    Array.from(
                        rel
                    ).join(" ")
                );
            }
        );
    }

    /* =========================================================
       RESPONSIVE EVENTS
       ========================================================= */

    function initializeResponsiveEvents() {
        if (
            APP.responsiveInitialized
        ) {
            return;
        }

        APP.responsiveInitialized =
            true;

        function synchronize() {
            APP.resizeFrame =
                null;

            syncSidePanel();

            updateNavigation();

            updateSectionNavigation();
        }

        function schedule() {
            if (
                APP.resizeFrame !==
                null
            ) {
                return;
            }

            if (
                typeof window.requestAnimationFrame ===
                "function"
            ) {
                APP.resizeFrame =
                    window.requestAnimationFrame(
                        synchronize
                    );

                return;
            }

            APP.resizeFrame =
                window.setTimeout(
                    synchronize,
                    0
                );
        }

        window.addEventListener(
            "resize",
            schedule,
            {
                passive:
                    true
            }
        );

        window.addEventListener(
            "orientationchange",
            schedule,
            {
                passive:
                    true
            }
        );

        window.addEventListener(
            "hashchange",
            function () {
                updateSectionNavigation();
            },
            {
                passive:
                    true
            }
        );
    }

    /* =========================================================
       AUTHENTICATION INITIALIZATION
       ========================================================= */

    async function initializeAuthentication() {
        if (!Auth) {
            return false;
        }

        try {
            if (
                typeof Auth.initialize ===
                "function"
            ) {
                Auth.initialize();
            }

            /*
             * verifySession() is the authority.
             *
             * Auth.initialize() restores
             * local/UI state only.
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
        } catch (error) {
            emit(
                "cybernexus:auth-error",
                {
                    error
                }
            );

            return false;
        }

        return false;
    }

    /* =========================================================
       ACCOUNT INITIALIZATION
       ========================================================= */

    async function initializeAccount(
        authenticated
    ) {
        if (
            !authenticated ||
            !Account ||
            typeof Account.initialize !==
                "function"
        ) {
            return null;
        }

        try {
            return await Account.initialize();
        } catch (error) {
            emit(
                "cybernexus:account-error",
                {
                    error
                }
            );

            return null;
        }
    }

    /* =========================================================
       READY STATE
       ========================================================= */

    function setReady(
        authenticated
    ) {
        if (
            APP.initialized
        ) {
            return;
        }

        APP.initialized =
            true;

        APP.initializing =
            false;

        document.documentElement.classList.add(
            "cn-app-ready"
        );

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

        emit(
            "cybernexus:ready",
            {
                page:
                    getPageName(),

                authenticated:
                    Boolean(
                        authenticated
                    )
            }
        );
    }

    /* =========================================================
       INITIALIZATION
       ========================================================= */

    async function initialize() {
        if (
            APP.initialized ||
            APP.initializing
        ) {
            return;
        }

        APP.initializing =
            true;

        try {
            validateDependencies();

            setCurrentPage();

            initializeNavigation();

            initializeSectionNavigation();

            initializeSidePanel();

            initializeStateSubscription();

            initializeAuthSubscription();

            initializeAccountSubscription();

            initializeForms();

            initializeResumeButtons();

            initializeNavigationKeys();

            initializeExternalLinks();

            initializeResponsiveEvents();

            updateNavigation();

            updateSectionNavigation();

            syncSidePanel();

            const authenticated =
                await initializeAuthentication();

            await initializeAccount(
                authenticated
            );

            setReady(
                authenticated
            );
        } catch (error) {
            APP.initializing =
                false;

            emit(
                "cybernexus:initialization-error",
                {
                    error
                }
            );

            document.documentElement.classList.remove(
                "cn-app-ready"
            );

            console.error(
                "CyberNexus frontend initialization failed:",
                error
            );
        }
    }

    /* =========================================================
       PUBLIC API
       ========================================================= */

    const WebApp =
        Object.freeze({
            initialize,

            isInitialized:
                function () {
                    return Boolean(
                        APP.initialized
                    );
                },

            isInitializing:
                function () {
                    return Boolean(
                        APP.initializing
                    );
                },

            on,

            emit,

            getPageName,

            getCurrentPage,

            getCurrentSection,

            updateNavigation,

            updateSectionNavigation,

            getSidePanelState,

            syncSidePanel,

            openSidePanel,

            closeSidePanel,

            toggleSidePanel,

            collapseSidePanel,

            restoreSidePanel,

            validateContactForm,

            submitContactRequest,

            handleContactFormSubmit,

            getResumePath,

            getFreshResumeUrl,

            openResume,

            downloadResume
        });

    /* =========================================================
       EXPORT
       ========================================================= */

    CyberNexus.WebApp =
        WebApp;

    window.CyberNexusWebApp =
        WebApp;

    /* =========================================================
       START
       ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            function () {
                void initialize();
            },
            {
                once:
                    true
            }
        );
    } else {
        void initialize();
    }

})(window, document);
