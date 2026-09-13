/*
 * CyberNexus IT Portfolio Platform
 * File: frontend/js/chat.js
 *
 * Responsibility:
 * - Chat and AI interaction behavior
 * - Chat message state
 * - Conversation identification
 * - Chat form/input interaction
 * - Chat message presentation
 *
 * Does NOT own:
 * - Generic HTTP transport
 * - API path construction
 * - Authentication implementation
 * - Account/profile management
 * - Persistent application state
 * - Main application lifecycle
 * - Voice interaction
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

    const Api =
        CyberNexus.Api ||
        window.CyberNexusApi ||
        null;

    const Auth =
        CyberNexus.Auth ||
        window.CyberNexusAuth ||
        null;

    /* =========================================================
       CHAT STATE
       ========================================================= */

    const CHAT = {
        initialized: false,

        busy: false,

        messages: [],

        conversationId: null,

        messageSequence: 0
    };

    /* =========================================================
       DOM HELPERS
       ========================================================= */

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

    function getErrorMessage(
        error
    ) {
        const fallback =
            "Unable to connect to the AI service.";

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

        return fallback;
    }

    function createMessageId() {
        CHAT.messageSequence += 1;

        return (
            "local-" +
            Date.now() +
            "-" +
            CHAT.messageSequence
        );
    }

    /* =========================================================
       MESSAGE NORMALIZATION
       ========================================================= */

    function normalizeRole(
        role
    ) {
        const value =
            normalizeString(
                role
            ).toLowerCase();

        const allowed =
            new Set([
                "system",
                "user",
                "assistant"
            ]);

        if (
            allowed.has(
                value
            )
        ) {
            return value;
        }

        return "assistant";
    }

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
            typeof message ===
            "string"
        ) {
            return {
                id:
                    createMessageId(),

                role:
                    "assistant",

                content:
                    message,

                timestamp:
                    Date.now()
            };
        }

        if (
            typeof message !==
                "object" ||
            Array.isArray(
                message
            )
        ) {
            return null;
        }

        const rawContent =
            message.content !==
            undefined
                ? message.content
                : message.message !==
                    undefined
                    ? message.message
                    : message.text !==
                        undefined
                        ? message.text
                        : "";

        const content =
            normalizeString(
                rawContent
            );

        if (!content) {
            return null;
        }

        const rawId =
            message.id !==
            undefined
                ? message.id
                : message.messageId !==
                    undefined
                    ? message.messageId
                    : null;

        const id =
            rawId === null ||
            rawId === undefined ||
            normalizeString(
                rawId
            ) === ""
                ? createMessageId()
                : String(
                      rawId
                  );

        const timestamp =
            message.timestamp ||
            message.created_at ||
            message.createdAt ||
            Date.now();

        return {
            id,

            role:
                normalizeRole(
                    message.role
                ),

            content,

            timestamp
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

        emit(
            "cybernexus:chat:message",
            {
                message:
                    Object.assign(
                        {},
                        normalized
                    )
            }
        );

        return normalized;
    }

    function addMessages(
        messages
    ) {
        if (
            !Array.isArray(
                messages
            )
        ) {
            return [];
        }

        return messages
            .map(
                function (message) {
                    return addMessage(
                        message
                    );
                }
            )
            .filter(
                Boolean
            );
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

        emit(
            "cybernexus:chat:cleared"
        );
    }

    /* =========================================================
       PRESENTATION
       ========================================================= */

    function setStatus(
        text,
        type
    ) {
        const elements =
            getElements();

        if (
            !elements.status
        ) {
            return;
        }

        const message =
            normalizeString(
                text
            );

        elements.status.hidden =
            !message;

        elements.status.textContent =
            message;

        elements.status.dataset.status =
            normalizeString(
                type
            );

        elements.status.classList.toggle(
            "is-error",
            type ===
                "error"
        );

        elements.status.classList.toggle(
            "is-loading",
            type ===
                "loading"
        );

        elements.status.classList.toggle(
            "is-success",
            type ===
                "success"
        );
    }

    function setBusy(
        busy
    ) {
        const value =
            Boolean(
                busy
            );

        const elements =
            getElements();

        CHAT.busy =
            value;

        if (
            elements.input
        ) {
            elements.input.disabled =
                value;

            elements.input.setAttribute(
                "aria-busy",
                String(
                    value
                )
            );
        }

        if (
            elements.send
        ) {
            elements.send.disabled =
                value;
        }

        if (value) {
            setStatus(
                "Thinking...",
                "loading"
            );
        }
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
            return null;
        }

        const normalized =
            normalizeMessage(
                message
            );

        if (!normalized) {
            return null;
        }

        const item =
            document.createElement(
                "article"
            );

        item.className =
            "cn-chat-message";

        item.dataset.role =
            normalized.role;

        item.dataset.messageId =
            String(
                normalized.id
            );

        const content =
            document.createElement(
                "div"
            );

        content.className =
            "cn-chat-message-content";

        /*
         * Security:
         *
         * Never use innerHTML for
         * chat content.
         *
         * Both user input and AI
         * output are untrusted data.
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

        return item;
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

        scrollToBottom();
    }

    /* =========================================================
       CONVERSATION
       ========================================================= */

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
            normalizeString(
                id
            );

        CHAT.conversationId =
            value ||
            null;

        return CHAT.conversationId;
    }

    function getConversationId() {
        return (
            CHAT.conversationId
        );
    }

    function resetConversation() {
        setConversationId(
            null
        );

        clearMessages();

        setStatus(
            ""
        );

        emit(
            "cybernexus:chat:new-conversation"
        );
    }

    /* =========================================================
       API RESPONSE
       ========================================================= */

    function getResponseData(
        response
    ) {
        if (
            response &&
            response.data &&
            typeof response.data ===
                "object" &&
            !Array.isArray(
                response.data
            )
        ) {
            return response.data;
        }

        if (
            response &&
            typeof response ===
                "object" &&
            !Array.isArray(
                response
            )
        ) {
            return response;
        }

        return {};
    }

    function extractReply(
        response
    ) {
        const data =
            getResponseData(
                response
            );

        if (
            typeof data ===
            "string"
        ) {
            return data;
        }

        if (
            !data ||
            typeof data !==
                "object"
        ) {
            return null;
        }

        const reply =
            data.reply ||
            data.message ||
            data.content ||
            data.response ||
            null;

        if (
            reply &&
            typeof reply ===
                "object"
        ) {
            if (
                typeof reply.content ===
                "string"
            ) {
                return reply.content;
            }

            if (
                typeof reply.message ===
                "string"
            ) {
                return reply.message;
            }

            if (
                typeof reply.text ===
                "string"
            ) {
                return reply.text;
            }
        }

        if (
            reply === null ||
            reply === undefined
        ) {
            return null;
        }

        return String(
            reply
        );
    }

    function extractMessages(
        response
    ) {
        const data =
            getResponseData(
                response
            );

        if (
            !data ||
            typeof data !==
                "object"
        ) {
            return [];
        }

        const messages =
            Array.isArray(
                data.messages
            )
                ? data.messages
                : [];

        return messages
            .map(
                normalizeMessage
            )
            .filter(
                Boolean
            );
    }

    function updateConversation(
        response
    ) {
        const data =
            getResponseData(
                response
            );

        if (
            !data ||
            typeof data !==
                "object"
        ) {
            return;
        }

        const id =
            data.conversation_id ||
            data.conversationId ||
            data.conversation ||
            null;

        if (
            id !== null &&
            id !== undefined
        ) {
            setConversationId(
                id
            );
        }
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
       AUTHENTICATION
       ========================================================= */

    async function requireAuthentication() {
        if (
            !Auth ||
            typeof Auth.verifySession !==
                "function"
        ) {
            throw new Error(
                "The authentication module is not available."
            );
        }

        const authenticated =
            await Auth.verifySession();

        if (!authenticated) {
            throw new Error(
                "Authentication is required to use the AI chat."
            );
        }

        return true;
    }

    /* =========================================================
       CHAT API
       ========================================================= */

    async function requestChat(
        content
    ) {
        if (
            !Api ||
            typeof Api.sendChat !==
                "function"
        ) {
            throw new Error(
                "The chat API method is not configured."
            );
        }

        /*
         * api-user.js owns the actual
         * /api/chat endpoint.
         */
        return Api.sendChat(
            {
                conversation_id:
                    CHAT.conversationId,

                message:
                    content
            }
        );
    }

    /* =========================================================
       SEND
       ========================================================= */

    async function send(
        message
    ) {
        const content =
            normalizeString(
                message
            );

        if (
            !content ||
            CHAT.busy
        ) {
            return null;
        }

        await requireAuthentication();

        /*
         * The user's message is added
         * only after authentication
         * succeeds.
         */
        const userMessage =
            addMessage({
                role:
                    "user",

                content
            });

        setBusy(
            true
        );

        try {
            const response =
                await requestChat(
                    content
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

            updateConversation(
                response
            );

            /*
             * If the backend returns a complete
             * message history, use it only when
             * it actually contains messages.
             *
             * Otherwise preserve the local
             * conversation and add the reply.
             */
            const responseMessages =
                extractMessages(
                    response
                );

            if (
                responseMessages.length >
                0
            ) {
                CHAT.messages =
                    responseMessages;

                renderMessages();
            } else {
                const reply =
                    extractReply(
                        response
                    );

                if (
                    reply !== null &&
                    normalizeString(
                        reply
                    )
                ) {
                    addMessage({
                        role:
                            "assistant",

                        content:
                            reply
                    });
                }
            }

            setStatus(
                ""
            );

            emit(
                "cybernexus:chat:success",
                {
                    response,

                    message:
                        userMessage,

                    conversationId:
                        CHAT.conversationId
                }
            );

            return response;
        } catch (error) {
            const messageText =
                getErrorMessage(
                    error
                );

            setStatus(
                messageText,
                "error"
            );

            emit(
                "cybernexus:chat:error",
                {
                    error,

                    message:
                        userMessage,

                    conversationId:
                        CHAT.conversationId
                }
            );

            throw error;
        } finally {
            setBusy(
                false
            );
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
            normalizeString(
                elements.input.value
            );

        if (!value) {
            return null;
        }

        /*
         * Clear immediately to prevent
         * duplicate submissions.
         */
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

    /* =========================================================
       FORM
       ========================================================= */

    function initializeForm() {
        const elements =
            getElements();

        if (
            !elements.form
        ) {
            return;
        }

        if (
            elements.form.dataset
                .chatBound ===
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

                void sendCurrentInput();
            }
        );
    }

    /* =========================================================
       INPUT
       ========================================================= */

    function initializeInput() {
        const elements =
            getElements();

        if (
            !elements.input
        ) {
            return;
        }

        if (
            elements.input.dataset
                .chatInputBound ===
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

                void sendCurrentInput();
            }
        );
    }

    /* =========================================================
       INITIALIZATION
       ========================================================= */

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

        emit(
            "cybernexus:chat-ready"
        );
    }

    function isInitialized() {
        return Boolean(
            CHAT.initialized
        );
    }

    function isBusy() {
        return Boolean(
            CHAT.busy
        );
    }

    /* =========================================================
       PUBLIC API
       ========================================================= */

    const Chat =
        Object.freeze({
            initialize,

            isInitialized,

            isBusy,

            send,

            sendCurrentInput,

            addMessage,

            addMessages,

            clearMessages,

            renderMessage,

            renderMessages,

            getMessages,

            setConversationId,

            getConversationId,

            resetConversation,

            setStatus
        });

    /* =========================================================
       EXPORT
       ========================================================= */

    CyberNexus.Chat =
        Chat;

    window.CyberNexusChat =
        Chat;

    /* =========================================================
       START
       ========================================================= */

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
