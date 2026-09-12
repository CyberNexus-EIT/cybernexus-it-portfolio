/* ==========================================================================
   CyberNexus IT Portfolio Platform
   File: frontend/js/chat.js

   Responsibility:
   - Chat and AI interaction behavior
   - Chat message state
   - Conversation identification
   - Chat form/input interaction
   - Chat message presentation

   Does NOT own:
   - Generic HTTP transport
   - API path construction
   - Authentication
   - Account/profile management
   - Application state
   - Main application lifecycle
   - Voice interaction
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

    const Api =
        CyberNexus.Api ||
        window.CyberNexusApi;

    const Auth =
        CyberNexus.Auth ||
        window.CyberNexusAuth;

    if (
        !Api ||
        typeof Api.post !== "function"
    ) {
        throw new Error(
            "CyberNexus.Api must be loaded before chat.js."
        );
    }

    if (
        !Auth ||
        typeof Auth.verifySession !== "function"
    ) {
        throw new Error(
            "CyberNexus.Auth must be loaded before chat.js."
        );
    }

    /* =======================================================
       CHAT STATE
    ======================================================= */

    const CHAT = {
        initialized: false,
        busy: false,
        messages: [],
        conversationId: null
    };

    /* =======================================================
       DOM
    ======================================================= */

    function getElements() {
        return {
            container:
                document.querySelector(
                    "[data-chat-messages]"
                ),

            form:
                document.querySelector(
                    "[data-chat-form]"
                ),

            input:
                document.querySelector(
                    "[data-chat-input]"
                ),

            send:
                document.querySelector(
                    "[data-chat-send]"
                ),

            status:
                document.querySelector(
                    "[data-chat-status]"
                )
        };
    }

    /* =======================================================
       MESSAGE
    ======================================================= */

    function normalizeMessage(
        message
    ) {
        if (
            message === null ||
            message === undefined
        ) {
            return null;
        }

        if (
            typeof message === "string"
        ) {
            return {
                id: null,
                role: "assistant",
                content: message,
                timestamp: Date.now()
            };
        }

        if (
            typeof message !== "object" ||
            Array.isArray(message)
        ) {
            return null;
        }

        const content =
            message.content !==
            undefined
                ? message.content
                : message.message !==
                    undefined
                    ? message.message
                    : "";

        const role =
            String(
                message.role ||
                    "assistant"
            ).trim() ||
            "assistant";

        return {
            id:
                message.id !==
                undefined
                    ? message.id
                    : null,

            role,

            content:
                String(content),

            timestamp:
                message.timestamp ||
                Date.now()
        };
    }

    function addMessage(
        message
    ) {
        const normalized =
            normalizeMessage(
                message
            );

        if (!normalized) {
            return null;
        }

        CHAT.messages.push(
            normalized
        );

        renderMessage(
            normalized
        );

        return normalized;
    }

    function getMessages() {
        return CHAT.messages.map(
            function (message) {
                return Object.assign(
                    {},
                    message
                );
            }
        );
    }

    function clearMessages() {
        CHAT.messages = [];

        const elements =
            getElements();

        if (
            elements.container
        ) {
            elements.container.replaceChildren();
        }
    }

    /* =======================================================
       PRESENTATION
    ======================================================= */

    function setStatus(
        text
    ) {
        const elements =
            getElements();

        if (
            !elements.status
        ) {
            return;
        }

        elements.status.textContent =
            String(
                text || ""
            );
    }

    function setBusy(
        busy
    ) {
        const value =
            Boolean(busy);

        const elements =
            getElements();

        CHAT.busy =
            value;

        if (
            elements.input
        ) {
            elements.input.disabled =
                value;
        }

        if (
            elements.send
        ) {
            elements.send.disabled =
                value;
        }

        setStatus(
            value
                ? "Thinking..."
                : ""
        );
    }

    function scrollToBottom() {
        const elements =
            getElements();

        if (
            !elements.container
        ) {
            return;
        }

        elements.container.scrollTop =
            elements.container.scrollHeight;
    }

    function renderMessage(
        message
    ) {
        const elements =
            getElements();

        if (
            !elements.container
        ) {
            return;
        }

        const normalized =
            normalizeMessage(
                message
            );

        if (!normalized) {
            return;
        }

        const item =
            document.createElement(
                "article"
            );

        item.className =
            "cn-chat-message";

        item.dataset.role =
            normalized.role;

        if (
            normalized.id !== null
        ) {
            item.dataset.messageId =
                String(
                    normalized.id
                );
        }

        const content =
            document.createElement(
                "div"
            );

        content.className =
            "cn-chat-message-content";

        /*
         * Never interpret user or AI
         * content as HTML.
         */
        content.textContent =
            normalized.content;

        item.appendChild(
            content
        );

        elements.container.appendChild(
            item
        );

        scrollToBottom();
    }

    function renderMessages() {
        const elements =
            getElements();

        if (
            !elements.container
        ) {
            return;
        }

        elements.container.replaceChildren();

        CHAT.messages.forEach(
            function (message) {
                renderMessage(
                    message
                );
            }
        );
    }

    /* =======================================================
       CONVERSATION
    ======================================================= */

    function setConversationId(
        id
    ) {
        if (
            id === null ||
            id === undefined
        ) {
            CHAT.conversationId =
                null;

            return null;
        }

        const value =
            String(id).trim();

        CHAT.conversationId =
            value || null;

        return CHAT.conversationId;
    }

    function getConversationId() {
        return CHAT.conversationId;
    }

    function extractReply(
        response
    ) {
        const data =
            response &&
            response.data;

        if (
            data === null ||
            data === undefined
        ) {
            return null;
        }

        if (
            typeof data === "string"
        ) {
            return data;
        }

        if (
            typeof data !== "object" ||
            Array.isArray(data)
        ) {
            return null;
        }

        return (
            data.reply ||
            data.message ||
            data.content ||
            data.response ||
            null
        );
    }

    function updateConversation(
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
            return;
        }

        const id =
            data.conversation_id ||
            data.conversationId;

        if (
            id !== null &&
            id !== undefined
        ) {
            setConversationId(
                id
            );
        }
    }

    /* =======================================================
       AUTHENTICATION
    ======================================================= */

    async function requireAuthentication() {
        const authenticated =
            await Auth.verifySession();

        if (!authenticated) {
            throw new Error(
                "Authentication is required to use the AI chat."
            );
        }

        return true;
    }

    /* =======================================================
       SEND
    ======================================================= */

    async function send(
        message
    ) {
        const content =
            String(
                message || ""
            ).trim();

        if (
            !content ||
            CHAT.busy
        ) {
            return null;
        }

        await requireAuthentication();

        addMessage({
            role: "user",
            content
        });

        setBusy(true);

        try {
            /*
             * The backend owns conversation
             * history. The frontend sends only
             * the conversation identifier and
             * current message.
             */
            const response =
                await Api.post(
                    "/chat",
                    {
                        conversation_id:
                            CHAT.conversationId,

                        message:
                            content
                    }
                );

            updateConversation(
                response
            );

            const reply =
                extractReply(
                    response
                );

            if (
                reply !== null &&
                String(reply).trim()
            ) {
                addMessage({
                    role:
                        "assistant",

                    content:
                        String(reply)
                });
            }

            setStatus("");

            return response;
        } catch (error) {
            const errorMessage =
                error &&
                error.message
                    ? error.message
                    : "Unable to connect to the AI service.";

            /*
             * Errors are UI status only.
             * They are never inserted into
             * the conversation history.
             */
            setStatus(
                errorMessage
            );

            throw error;
        } finally {
            setBusy(false);
        }
    }

    async function sendCurrentInput() {
        const elements =
            getElements();

        if (
            !elements.input ||
            CHAT.busy
        ) {
            return null;
        }

        const value =
            elements.input.value.trim();

        if (!value) {
            return null;
        }

        elements.input.value =
            "";

        try {
            return await send(
                value
            );
        } catch (
            error
        ) {
            return null;
        }
    }

    /* =======================================================
       FORM
    ======================================================= */

    function initializeForm() {
        const elements =
            getElements();

        if (
            !elements.form
        ) {
            return;
        }

        if (
            elements.form.dataset.chatBound ===
            "true"
        ) {
            return;
        }

        elements.form.dataset.chatBound =
            "true";

        elements.form.addEventListener(
            "submit",
            function (event) {
                event.preventDefault();

                sendCurrentInput();
            }
        );
    }

    function initializeInput() {
        const elements =
            getElements();

        if (
            !elements.input
        ) {
            return;
        }

        if (
            elements.input.dataset.chatInputBound ===
            "true"
        ) {
            return;
        }

        elements.input.dataset.chatInputBound =
            "true";

        elements.input.addEventListener(
            "keydown",
            function (event) {
                if (
                    event.key !==
                        "Enter" ||
                    event.shiftKey ||
                    event.isComposing
                ) {
                    return;
                }

                event.preventDefault();

                sendCurrentInput();
            }
        );
    }

    /* =======================================================
       LIFECYCLE
    ======================================================= */

    function initialize() {
        if (
            CHAT.initialized
        ) {
            return;
        }

        initializeForm();
        initializeInput();

        CHAT.initialized =
            true;

        document.dispatchEvent(
            new CustomEvent(
                "cybernexus:chat-ready"
            )
        );
    }

    function isInitialized() {
        return CHAT.initialized;
    }

    function isBusy() {
        return CHAT.busy;
    }

    /* =======================================================
       PUBLIC API
    ======================================================= */

    const Chat =
        Object.freeze({
            initialize,
            isInitialized,
            isBusy,

            send,
            sendCurrentInput,

            addMessage,
            clearMessages,
            renderMessages,
            getMessages,

            setConversationId,
            getConversationId,

            setStatus
        });

    /* =======================================================
       GLOBAL EXPORT
    ======================================================= */

    CyberNexus.Chat =
        Chat;

    window.CyberNexusChat =
        Chat;

    /* =======================================================
       START
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
