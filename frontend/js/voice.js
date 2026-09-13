/*
 * CyberNexus IT Portfolio Platform
 * File: frontend/js/voice.js
 *
 * Responsibility:
 * - Voice input and speech output behavior
 * - Speech recognition
 * - Speech synthesis
 * - Voice settings
 * - Voice control state
 * - Voice-to-chat integration
 *
 * Does NOT own:
 * - Generic HTTP transport
 * - API path construction
 * - Authentication
 * - Account/profile management
 * - Persistent application state
 * - Chat API requests
 * - Main application lifecycle
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

    const Chat =
        CyberNexus.Chat ||
        window.CyberNexusChat ||
        null;

    /* =========================================================
       CONSTANTS
       ========================================================= */

    const DEFAULT_SETTINGS = Object.freeze({
        language: "en-US",

        continuous: false,

        interimResults: true,

        maxAlternatives: 1,

        rate: 1,

        pitch: 1,

        volume: 1
    });

    const STATUS_MESSAGES = Object.freeze({
        listening:
            "Listening...",

        speaking:
            "Speaking...",

        noSpeech:
            "No speech detected.",

        microphone:
            "No microphone was detected.",

        permission:
            "Microphone permission was denied.",

        recognitionUnsupported:
            "Voice input is not supported by this browser.",

        synthesisUnsupported:
            "Speech output is not supported by this browser.",

        recognitionStartError:
            "Unable to start voice input.",

        synthesisStartError:
            "Unable to start speech output.",

        recognitionError:
            "Voice input error.",

        synthesisError:
            "Speech output error."
    });

    /* =========================================================
       STATE
       ========================================================= */

    const VOICE = {
        initialized: false,

        listening: false,

        speaking: false,

        recognitionStarting: false,

        recognitionStopping: false,

        recognition: null,

        synthesis:
            typeof window.speechSynthesis !==
                "undefined"
                ? window.speechSynthesis
                : null,

        settings: Object.assign(
            {},
            DEFAULT_SETTINGS
        ),

        speechGeneration: 0,

        recognitionGeneration: 0,

        finalTranscript: "",

        interimTranscript: "",

        lastTranscript: "",

        selectedVoice: null,

        voicesReady: false,

        voicesChangedHandler: null,

        buttonBound: false,

        statusElement: null
    };

    /* =========================================================
       DOM HELPERS
       ========================================================= */

    function getInput() {
        return document.querySelector(
            "[data-chat-input]"
        );
    }

    function getVoiceButton() {
        return document.querySelector(
            "[data-voice-toggle]"
        );
    }

    function getVoiceStatusElement() {
        return (
            document.querySelector(
                "[data-voice-status]"
            ) ||
            document.querySelector(
                "[data-chat-voice-status]"
            )
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

        return String(value).trim();
    }

    function isObject(
        value
    ) {
        return (
            value !== null &&
            typeof value ===
                "object" &&
            !Array.isArray(value)
        );
    }

    function clamp(
        value,
        minimum,
        maximum
    ) {
        return Math.min(
            maximum,
            Math.max(
                minimum,
                value
            )
        );
    }

    function dispatch(
        name,
        detail
    ) {
        const eventName =
            normalizeString(
                name
            );

        if (!eventName) {
            return;
        }

        document.dispatchEvent(
            new CustomEvent(
                eventName,
                {
                    detail:
                        detail ===
                            undefined
                            ? {}
                            : detail
                }
            )
        );
    }

    /* =========================================================
       STATUS
       ========================================================= */

    function setStatus(
        message
    ) {
        const element =
            getVoiceStatusElement();

        if (!element) {
            return;
        }

        element.textContent =
            normalizeString(
                message
            );

        element.hidden =
            !normalizeString(
                message
            );
    }

    function clearStatus() {
        setStatus("");
    }

    /* =========================================================
       BUTTON STATE
       ========================================================= */

    function updateButton() {
        const button =
            getVoiceButton();

        if (!button) {
            return;
        }

        const active =
            VOICE.listening ||
            VOICE.recognitionStarting;

        button.classList.toggle(
            "is-active",
            active
        );

        button.classList.toggle(
            "is-listening",
            active
        );

        button.classList.toggle(
            "is-speaking",
            VOICE.speaking
        );

        button.setAttribute(
            "aria-pressed",
            String(active)
        );

        button.setAttribute(
            "aria-busy",
            String(
                VOICE.recognitionStarting ||
                VOICE.speaking
            )
        );

        button.setAttribute(
            "aria-label",
            active
                ? "Stop voice input"
                : "Start voice input"
        );

        button.setAttribute(
            "title",
            active
                ? "Stop voice input"
                : "Start voice input"
        );

        button.dataset.voiceState =
            active
                ? "listening"
                : VOICE.speaking
                    ? "speaking"
                    : "idle";
    }

    /* =========================================================
       RECOGNITION SUPPORT
       ========================================================= */

    function getRecognitionConstructor() {
        return (
            window.SpeechRecognition ||
            window.webkitSpeechRecognition ||
            null
        );
    }

    function isRecognitionSupported() {
        return Boolean(
            getRecognitionConstructor()
        );
    }

    function isSpeechSynthesisSupported() {
        return Boolean(
            VOICE.synthesis &&
            typeof window
                .SpeechSynthesisUtterance ===
                "function"
        );
    }

    /* =========================================================
       RECOGNITION TRANSCRIPT
       ========================================================= */

    function resetTranscript() {
        VOICE.finalTranscript =
            "";

        VOICE.interimTranscript =
            "";

        VOICE.lastTranscript =
            "";
    }

    function getCombinedTranscript() {
        const finalText =
            normalizeString(
                VOICE.finalTranscript
            );

        const interimText =
            normalizeString(
                VOICE.interimTranscript
            );

        if (
            finalText &&
            interimText
        ) {
            return (
                finalText +
                " " +
                interimText
            ).trim();
        }

        return (
            finalText ||
            interimText
        );
    }

    function updateInput(
        text
    ) {
        const input =
            getInput();

        if (!input) {
            return;
        }

        const value =
            normalizeString(
                text
            );

        input.value =
            value;

        input.dispatchEvent(
            new Event(
                "input",
                {
                    bubbles:
                        true
                }
            )
        );
    }

    /* =========================================================
       RECOGNITION INSTANCE
       ========================================================= */

    function createRecognition() {
        const Recognition =
            getRecognitionConstructor();

        if (!Recognition) {
            return null;
        }

        const recognition =
            new Recognition();

        recognition.lang =
            VOICE.settings.language;

        recognition.continuous =
            VOICE.settings.continuous;

        recognition.interimResults =
            VOICE.settings.interimResults;

        recognition.maxAlternatives =
            VOICE.settings.maxAlternatives;

        recognition.onstart =
            function () {
                VOICE.listening =
                    true;

                VOICE.recognitionStarting =
                    false;

                VOICE.recognitionStopping =
                    false;

                updateButton();

                setStatus(
                    STATUS_MESSAGES.listening
                );

                dispatch(
                    "cybernexus:voice-start",
                    {
                        language:
                            VOICE.settings
                                .language
                    }
                );
            };

        recognition.onresult =
            function (event) {
                handleRecognitionResult(
                    event
                );
            };

        recognition.onerror =
            function (event) {
                handleRecognitionError(
                    event
                );
            };

        recognition.onend =
            function () {
                handleRecognitionEnd();
            };

        return recognition;
    }

    function initializeRecognition() {
        if (
            VOICE.recognition
        ) {
            return VOICE.recognition;
        }

        VOICE.recognition =
            createRecognition();

        return VOICE.recognition;
    }

    /* =========================================================
       RECOGNITION RESULT
       ========================================================= */

    function handleRecognitionResult(
        event
    ) {
        if (!event) {
            return;
        }

        let finalParts = [];

        let interimParts = [];

        for (
            let index =
                event.resultIndex;
            index <
            event.results.length;
            index += 1
        ) {
            const result =
                event.results[
                    index
                ];

            if (
                !result ||
                !result[0]
            ) {
                continue;
            }

            const transcript =
                normalizeString(
                    result[0]
                        .transcript
                );

            if (!transcript) {
                continue;
            }

            if (
                result.isFinal
            ) {
                finalParts.push(
                    transcript
                );
            } else {
                interimParts.push(
                    transcript
                );
            }
        }

        const finalText =
            finalParts
                .join(" ")
                .trim();

        const interimText =
            interimParts
                .join(" ")
                .trim();

        if (finalText) {
            VOICE.finalTranscript =
                [
                    VOICE.finalTranscript,
                    finalText
                ]
                    .filter(Boolean)
                    .join(" ")
                    .trim();
        }

        VOICE.interimTranscript =
            interimText;

        const combined =
            getCombinedTranscript();

        VOICE.lastTranscript =
            combined;

        updateInput(
            combined
        );

        const isFinal =
            Boolean(
                finalText
            );

        dispatch(
            "cybernexus:voice-result",
            {
                transcript:
                    combined,

                finalTranscript:
                    VOICE.finalTranscript,

                interimTranscript:
                    VOICE.interimTranscript,

                final:
                    isFinal
            }
        );
    }

    /* =========================================================
       RECOGNITION ERROR
       ========================================================= */

    function getRecognitionErrorMessage(
        code
    ) {
        switch (code) {
            case "no-speech":
                return STATUS_MESSAGES.noSpeech;

            case "audio-capture":
                return STATUS_MESSAGES.microphone;

            case "not-allowed":
            case "service-not-allowed":
                return STATUS_MESSAGES.permission;

            case "network":
                return "A voice recognition network error occurred.";

            case "language-not-supported":
                return "The selected voice language is not supported.";

            case "phrases-not-supported":
                return "Voice recognition phrases are not supported.";

            case "aborted":
                return "";

            default:
                return (
                    code
                        ? "Voice input error: " +
                            code
                        : STATUS_MESSAGES
                              .recognitionError
                );
        }
    }

    function handleRecognitionError(
        event
    ) {
        const errorCode =
            normalizeString(
                event &&
                    event.error
            );

        VOICE.listening =
            false;

        VOICE.recognitionStarting =
            false;

        VOICE.recognitionStopping =
            false;

        updateButton();

        const message =
            getRecognitionErrorMessage(
                errorCode
            );

        setStatus(
            message
        );

        dispatch(
            "cybernexus:voice-error",
            {
                error:
                    errorCode,

                event:
                    event || null
            }
        );
    }

    /* =========================================================
       RECOGNITION END
       ========================================================= */

    function handleRecognitionEnd() {
        const wasListening =
            VOICE.listening;

        VOICE.listening =
            false;

        VOICE.recognitionStarting =
            false;

        VOICE.recognitionStopping =
            false;

        updateButton();

        /*
         * Do not erase a useful error message
         * immediately after recognition ends.
         */
        if (
            !VOICE.lastTranscript
        ) {
            clearStatus();
        }

        dispatch(
            "cybernexus:voice-end",
            {
                transcript:
                    VOICE.finalTranscript,

                wasListening
            }
        );

        /*
         * Non-continuous recognition normally ends
         * after a final result. Keep the transcript
         * available for Chat integration.
         */
        if (
            VOICE.finalTranscript
        ) {
            dispatch(
                "cybernexus:voice-final",
                {
                    transcript:
                        VOICE.finalTranscript
                }
            );
        }
    }

    /* =========================================================
       START LISTENING
       ========================================================= */

    function startListening() {
        if (
            VOICE.listening ||
            VOICE.recognitionStarting
        ) {
            return true;
        }

        if (
            !isRecognitionSupported()
        ) {
            setStatus(
                STATUS_MESSAGES
                    .recognitionUnsupported
            );

            dispatch(
                "cybernexus:voice-unsupported",
                {
                    feature:
                        "recognition"
                }
            );

            return false;
        }

        if (
            VOICE.speaking
        ) {
            stopSpeaking();
        }

        const recognition =
            initializeRecognition();

        if (!recognition) {
            setStatus(
                STATUS_MESSAGES
                    .recognitionUnsupported
            );

            return false;
        }

        resetTranscript();

        VOICE.recognitionGeneration +=
            1;

        VOICE.recognitionStarting =
            true;

        VOICE.recognitionStopping =
            false;

        recognition.lang =
            VOICE.settings.language;

        recognition.continuous =
            VOICE.settings.continuous;

        recognition.interimResults =
            VOICE.settings.interimResults;

        recognition.maxAlternatives =
            VOICE.settings.maxAlternatives;

        updateButton();

        try {
            recognition.start();

            return true;
        } catch (error) {
            VOICE.recognitionStarting =
                false;

            VOICE.listening =
                false;

            updateButton();

            /*
             * InvalidStateError can happen when
             * the browser is already starting.
             */
            if (
                error &&
                error.name ===
                    "InvalidStateError"
            ) {
                return true;
            }

            setStatus(
                STATUS_MESSAGES
                    .recognitionStartError
            );

            dispatch(
                "cybernexus:voice-error",
                {
                    error
                }
            );

            return false;
        }
    }

    /* =========================================================
       STOP LISTENING
       ========================================================= */

    function stopListening() {
        const recognition =
            VOICE.recognition;

        if (!recognition) {
            return false;
        }

        if (
            !VOICE.listening &&
            !VOICE.recognitionStarting
        ) {
            return false;
        }

        VOICE.recognitionStopping =
            true;

        try {
            recognition.stop();

            return true;
        } catch (error) {
            VOICE.listening =
                false;

            VOICE.recognitionStarting =
                false;

            VOICE.recognitionStopping =
                false;

            updateButton();

            dispatch(
                "cybernexus:voice-error",
                {
                    error
                }
            );

            return false;
        }
    }

    /* =========================================================
       ABORT LISTENING
       ========================================================= */

    function abortListening() {
        const recognition =
            VOICE.recognition;

        if (!recognition) {
            return false;
        }

        if (
            !VOICE.listening &&
            !VOICE.recognitionStarting
        ) {
            return false;
        }

        VOICE.recognitionStopping =
            true;

        try {
            recognition.abort();

            return true;
        } catch (error) {
            VOICE.listening =
                false;

            VOICE.recognitionStarting =
                false;

            VOICE.recognitionStopping =
                false;

            updateButton();

            clearStatus();

            dispatch(
                "cybernexus:voice-error",
                {
                    error
                }
            );

            return false;
        }
    }

    function toggleListening() {
        if (
            VOICE.listening ||
            VOICE.recognitionStarting
        ) {
            return stopListening();
        }

        return startListening();
    }

    /* =========================================================
       VOICE-TO-CHAT
       ========================================================= */

    async function sendTranscriptToChat(
        transcript
    ) {
        const message =
            normalizeString(
                transcript
            );

        if (!message) {
            return null;
        }

        if (
            !Chat ||
            typeof Chat.send !==
                "function"
        ) {
            dispatch(
                "cybernexus:voice-chat-unavailable",
                {
                    transcript:
                        message
                }
            );

            return null;
        }

        try {
            const response =
                await Chat.send(
                    message
                );

            dispatch(
                "cybernexus:voice-chat-sent",
                {
                    transcript:
                        message,

                    response
                }
            );

            return response;
        } catch (error) {
            dispatch(
                "cybernexus:voice-chat-error",
                {
                    transcript:
                        message,

                    error
                }
            );

            throw error;
        }
    }

    /* =========================================================
       SPEECH SYNTHESIS
       ========================================================= */

    function getSpeechUtterance() {
        if (
            typeof window
                .SpeechSynthesisUtterance !==
                "function"
        ) {
            return null;
        }

        return window
            .SpeechSynthesisUtterance;
    }

    function getAvailableVoices() {
        if (
            !VOICE.synthesis
        ) {
            return [];
        }

        try {
            return VOICE.synthesis
                .getVoices()
                .slice();
        } catch (error) {
            return [];
        }
    }

    function findVoice(
        value
    ) {
        if (
            !value
        ) {
            return null;
        }

        const voices =
            getAvailableVoices();

        if (!voices.length) {
            return null;
        }

        if (
            typeof value ===
            "object"
        ) {
            return (
                voices.find(
                    function (voice) {
                        return (
                            voice ===
                            value
                        );
                    }
                ) ||
                null
            );
        }

        const requested =
            normalizeString(
                value
            ).toLowerCase();

        if (!requested) {
            return null;
        }

        return (
            voices.find(
                function (voice) {
                    return (
                        normalizeString(
                            voice.name
                        ).toLowerCase() ===
                        requested
                    );
                }
            ) ||
            voices.find(
                function (voice) {
                    return (
                        normalizeString(
                            voice.voiceURI
                        ).toLowerCase() ===
                        requested
                    );
                }
            ) ||
            null
        );
    }

    function refreshVoices() {
        const voices =
            getAvailableVoices();

        VOICE.voicesReady =
            voices.length > 0;

        if (
            VOICE.selectedVoice
        ) {
            const current =
                findVoice(
                    VOICE.selectedVoice
                );

            if (current) {
                VOICE.selectedVoice =
                    current;
            }
        }

        dispatch(
            "cybernexus:voices-ready",
            {
                voices:
                    voices.slice()
            }
        );

        return voices;
    }

    function initializeVoices() {
        if (
            !VOICE.synthesis
        ) {
            return;
        }

        refreshVoices();

        if (
            typeof VOICE.synthesis
                .addEventListener ===
            "function"
        ) {
            VOICE.voicesChangedHandler =
                refreshVoices;

            VOICE.synthesis.addEventListener(
                "voiceschanged",
                VOICE.voicesChangedHandler
            );
        } else {
            VOICE.synthesis.onvoiceschanged =
                refreshVoices;
        }
    }

    /* =========================================================
       STOP SPEAKING
       ========================================================= */

    function stopSpeaking() {
        const wasSpeaking =
            VOICE.speaking;

        VOICE.speechGeneration +=
            1;

        if (
            VOICE.synthesis
        ) {
            try {
                VOICE.synthesis.cancel();
            } catch (error) {
                dispatch(
                    "cybernexus:speech-error",
                    {
                        error
                    }
                );
            }
        }

        VOICE.speaking =
            false;

        updateButton();

        if (
            wasSpeaking
        ) {
            clearStatus();

            dispatch(
                "cybernexus:speech-end",
                {
                    cancelled:
                        true
                }
            );
        }

        return wasSpeaking;
    }

    /* =========================================================
       SPEAK
       ========================================================= */

    function speak(
        text,
        options
    ) {
        const message =
            normalizeString(
                text
            );

        if (!message) {
            return false;
        }

        if (
            !isSpeechSynthesisSupported()
        ) {
            setStatus(
                STATUS_MESSAGES
                    .synthesisUnsupported
            );

            dispatch(
                "cybernexus:speech-unsupported",
                {
                    feature:
                        "synthesis"
                }
            );

            return false;
        }

        const value =
            isObject(options)
                ? options
                : {};

        if (
            VOICE.listening ||
            VOICE.recognitionStarting
        ) {
            stopListening();
        }

        stopSpeaking();

        const generation =
            VOICE.speechGeneration;

        const Utterance =
            getSpeechUtterance();

        if (!Utterance) {
            return false;
        }

        const utterance =
            new Utterance(
                message
            );

        const rate =
            Number.isFinite(
                value.rate
            )
                ? value.rate
                : VOICE.settings.rate;

        const pitch =
            Number.isFinite(
                value.pitch
            )
                ? value.pitch
                : VOICE.settings.pitch;

        const volume =
            Number.isFinite(
                value.volume
            )
                ? value.volume
                : VOICE.settings.volume;

        const language =
            typeof value.language ===
                "string" &&
            value.language.trim()
                ? value.language.trim()
                : VOICE.settings.language;

        const voice =
            value.voice
                ? findVoice(
                      value.voice
                  )
                : VOICE.selectedVoice;

        utterance.lang =
            language;

        utterance.rate =
            clamp(
                rate,
                0.1,
                10
            );

        utterance.pitch =
            clamp(
                pitch,
                0,
                2
            );

        utterance.volume =
            clamp(
                volume,
                0,
                1
            );

        if (voice) {
            utterance.voice =
                voice;
        }

        utterance.onstart =
            function () {
                if (
                    generation !==
                    VOICE.speechGeneration
                ) {
                    return;
                }

                VOICE.speaking =
                    true;

                updateButton();

                setStatus(
                    STATUS_MESSAGES.speaking
                );

                dispatch(
                    "cybernexus:speech-start",
                    {
                        text:
                            message,

                        voice:
                            utterance.voice ||
                            null,

                        language:
                            utterance.lang
                    }
                );
            };

        utterance.onend =
            function () {
                if (
                    generation !==
                    VOICE.speechGeneration
                ) {
                    return;
                }

                VOICE.speaking =
                    false;

                updateButton();

                clearStatus();

                dispatch(
                    "cybernexus:speech-end",
                    {
                        text:
                            message,

                        cancelled:
                            false
                    }
                );
            };

        utterance.onerror =
            function (event) {
                if (
                    generation !==
                    VOICE.speechGeneration
                ) {
                    return;
                }

                VOICE.speaking =
                    false;

                updateButton();

                setStatus(
                    STATUS_MESSAGES
                        .synthesisError
                );

                dispatch(
                    "cybernexus:speech-error",
                    {
                        event:
                            event ||
                            null,

                        text:
                            message
                    }
                );
            };

        try {
            VOICE.synthesis.speak(
                utterance
            );

            dispatch(
                "cybernexus:speech-queued",
                {
                    text:
                        message
                }
            );

            return true;
        } catch (error) {
            if (
                generation ===
                VOICE.speechGeneration
            ) {
                VOICE.speaking =
                    false;

                updateButton();

                setStatus(
                    STATUS_MESSAGES
                        .synthesisStartError
                );

                dispatch(
                    "cybernexus:speech-error",
                    {
                        error,

                        text:
                            message
                    }
                );
            }

            return false;
        }
    }

    /* =========================================================
       SETTINGS
       ========================================================= */

    function setLanguage(
        language
    ) {
        const value =
            normalizeString(
                language
            );

        if (!value) {
            return VOICE.settings
                .language;
        }

        VOICE.settings.language =
            value;

        if (
            VOICE.recognition
        ) {
            VOICE.recognition.lang =
                value;
        }

        return value;
    }

    function setVoice(
        voice
    ) {
        const selected =
            findVoice(
                voice
            );

        if (!selected) {
            return null;
        }

        VOICE.selectedVoice =
            selected;

        dispatch(
            "cybernexus:voice-selected",
            {
                voice:
                    selected
            }
        );

        return selected;
    }

    function configure(
        options
    ) {
        const value =
            isObject(options)
                ? options
                : {};

        if (
            typeof value.language ===
            "string"
        ) {
            setLanguage(
                value.language
            );
        }

        if (
            typeof value.continuous ===
            "boolean"
        ) {
            VOICE.settings.continuous =
                value.continuous;
        }

        if (
            typeof value.interimResults ===
            "boolean"
        ) {
            VOICE.settings.interimResults =
                value.interimResults;
        }

        if (
            Number.isFinite(
                value.maxAlternatives
            )
        ) {
            VOICE.settings.maxAlternatives =
                Math.max(
                    1,
                    Math.min(
                        5,
                        Math.floor(
                            value.maxAlternatives
                        )
                    )
                );
        }

        if (
            Number.isFinite(
                value.rate
            )
        ) {
            VOICE.settings.rate =
                clamp(
                    value.rate,
                    0.1,
                    10
                );
        }

        if (
            Number.isFinite(
                value.pitch
            )
        ) {
            VOICE.settings.pitch =
                clamp(
                    value.pitch,
                    0,
                    2
                );
        }

        if (
            Number.isFinite(
                value.volume
            )
        ) {
            VOICE.settings.volume =
                clamp(
                    value.volume,
                    0,
                    1
                );
        }

        if (
            value.voice
        ) {
            setVoice(
                value.voice
            );
        }

        if (
            VOICE.recognition
        ) {
            VOICE.recognition.lang =
                VOICE.settings.language;

            VOICE.recognition.continuous =
                VOICE.settings.continuous;

            VOICE.recognition.interimResults =
                VOICE.settings.interimResults;

            VOICE.recognition.maxAlternatives =
                VOICE.settings.maxAlternatives;
        }

        updateButton();

        return getSettings();
    }

    function getSettings() {
        return Object.assign(
            {},
            VOICE.settings,
            {
                voice:
                    VOICE.selectedVoice
                        ? {
                              name:
                                  VOICE
                                      .selectedVoice
                                      .name,

                              lang:
                                  VOICE
                                      .selectedVoice
                                      .lang,

                              voiceURI:
                                  VOICE
                                      .selectedVoice
                                      .voiceURI
                          }
                        : null
            }
        );
    }

    function getVoices() {
        return getAvailableVoices().map(
            function (voice) {
                return {
                    name:
                        voice.name,

                    lang:
                        voice.lang,

                    localService:
                        Boolean(
                            voice.localService
                        ),

                    default:
                        Boolean(
                            voice.default
                        ),

                    voiceURI:
                        voice.voiceURI
                };
            }
        );
    }

    /* =========================================================
       STATE
       ========================================================= */

    function isListening() {
        return Boolean(
            VOICE.listening
        );
    }

    function isSpeaking() {
        return Boolean(
            VOICE.speaking
        );
    }

    function getTranscript() {
        return (
            VOICE.finalTranscript ||
            VOICE.lastTranscript ||
            ""
        );
    }

    function getState() {
        return {
            initialized:
                VOICE.initialized,

            listening:
                VOICE.listening,

            speaking:
                VOICE.speaking,

            recognitionStarting:
                VOICE.recognitionStarting,

            recognitionStopping:
                VOICE.recognitionStopping,

            finalTranscript:
                VOICE.finalTranscript,

            interimTranscript:
                VOICE.interimTranscript,

            transcript:
                getTranscript(),

            recognitionSupported:
                isRecognitionSupported(),

            synthesisSupported:
                isSpeechSynthesisSupported()
        };
    }

    /* =========================================================
       BUTTON
       ========================================================= */

    function initializeButton() {
        const button =
            getVoiceButton();

        if (!button) {
            return;
        }

        if (
            VOICE.buttonBound
        ) {
            updateButton();

            return;
        }

        VOICE.buttonBound =
            true;

        button.type =
            "button";

        button.addEventListener(
            "click",
            function (event) {
                event.preventDefault();

                toggleListening();
            }
        );

        updateButton();
    }

    /* =========================================================
       LIFECYCLE
       ========================================================= */

    function initialize() {
        if (
            VOICE.initialized
        ) {
            return;
        }

        initializeRecognition();

        initializeVoices();

        initializeButton();

        VOICE.initialized =
            true;

        updateButton();

        dispatch(
            "cybernexus:voice-ready",
            {
                recognition:
                    isRecognitionSupported(),

                synthesis:
                    isSpeechSynthesisSupported()
            }
        );
    }

    function isInitialized() {
        return Boolean(
            VOICE.initialized
        );
    }

    /* =========================================================
       PUBLIC API
       ========================================================= */

    const VoiceAPI =
        Object.freeze({
            initialize,

            isInitialized,

            startListening,
            stopListening,
            abortListening,
            toggleListening,

            speak,
            stopSpeaking,

            sendTranscriptToChat,

            configure,
            getSettings,
            setLanguage,
            setVoice,

            getVoices,

            isListening,
            isSpeaking,

            getTranscript,
            getState,

            isRecognitionSupported,
            isSpeechSynthesisSupported
        });

    /* =========================================================
       EXPORT
       ========================================================= */

    CyberNexus.Voice =
        VoiceAPI;

    window.CyberNexusVoice =
        VoiceAPI;

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
