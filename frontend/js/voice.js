/* ==========================================================================
   CyberNexus IT Portfolio Platform
   File: frontend/js/voice.js
   Purpose: Voice input and speech output behavior
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
       STATE
    ========================================================================== */

    const Voice = {
        initialized: false,
        listening: false,
        speaking: false,

        recognition: null,

        synthesis:
            typeof window.speechSynthesis !==
            "undefined"
                ? window.speechSynthesis
                : null,

        speechGeneration: 0,

        settings: {
            language: "en-US",
            continuous: false,
            interimResults: true,
            rate: 1,
            pitch: 1,
            volume: 1
        }
    };

    /* ==========================================================================
       DOM
    ========================================================================== */

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

    function getStatusElement() {
        return document.querySelector(
            "[data-voice-status]"
        );
    }

    /* ==========================================================================
       STATUS
    ========================================================================== */

    function setStatus(message) {
        const element =
            getStatusElement();

        if (!element) {
            return;
        }

        element.textContent =
            String(message || "");
    }

    function dispatch(name, detail) {
        document.dispatchEvent(
            new CustomEvent(
                name,
                detail === undefined
                    ? undefined
                    : {
                        detail: detail
                    }
            )
        );
    }

    /* ==========================================================================
       BUTTON
    ========================================================================== */

    function updateButton() {
        const button =
            getVoiceButton();

        if (!button) {
            return;
        }

        const active =
            Voice.listening;

        button.classList.toggle(
            "is-active",
            active
        );

        button.setAttribute(
            "aria-pressed",
            String(active)
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
    }

    /* ==========================================================================
       SPEECH RECOGNITION
    ========================================================================== */

    function getRecognitionConstructor() {
        return (
            window.SpeechRecognition ||
            window.webkitSpeechRecognition ||
            null
        );
    }

    function createRecognition() {
        const Recognition =
            getRecognitionConstructor();

        if (!Recognition) {
            return null;
        }

        const recognition =
            new Recognition();

        recognition.lang =
            Voice.settings.language;

        recognition.continuous =
            Voice.settings.continuous;

        recognition.interimResults =
            Voice.settings.interimResults;

        recognition.onstart =
            function () {
                Voice.listening =
                    true;

                updateButton();

                setStatus(
                    "Listening..."
                );

                dispatch(
                    "cybernexus:voice-start"
                );
            };

        recognition.onresult =
            function (event) {
                const input =
                    getInput();

                let transcript = "";
                let finalTranscript = "";

                for (
                    let index =
                        event.resultIndex;
                    index <
                    event.results.length;
                    index += 1
                ) {
                    const result =
                        event.results[index];

                    if (
                        !result ||
                        !result[0]
                    ) {
                        continue;
                    }

                    const text =
                        String(
                            result[0]
                                .transcript ||
                            ""
                        ).trim();

                    if (!text) {
                        continue;
                    }

                    transcript +=
                        (transcript
                            ? " "
                            : "") +
                        text;

                    if (
                        result.isFinal
                    ) {
                        finalTranscript +=
                            (
                                finalTranscript
                                    ? " "
                                    : ""
                            ) +
                            text;
                    }
                }

                transcript =
                    transcript.trim();

                finalTranscript =
                    finalTranscript.trim();

                if (
                    input &&
                    transcript
                ) {
                    input.value =
                        transcript;

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

                const lastResult =
                    event.results[
                        event.results.length -
                        1
                    ];

                const isFinal =
                    Boolean(
                        lastResult &&
                        lastResult.isFinal
                    );

                dispatch(
                    "cybernexus:voice-result",
                    {
                        transcript:
                            transcript,

                        final:
                            isFinal,

                        finalTranscript:
                            finalTranscript
                    }
                );
            };

        recognition.onerror =
            function (event) {
                const errorCode =
                    event &&
                    event.error
                        ? String(
                            event.error
                        )
                        : "";

                Voice.listening =
                    false;

                updateButton();

                if (
                    errorCode ===
                    "aborted"
                ) {
                    setStatus("");

                    dispatch(
                        "cybernexus:voice-abort",
                        event || null
                    );

                    return;
                }

                setStatus(
                    errorCode
                        ? "Voice input error: " +
                            errorCode
                        : "Voice input error."
                );

                dispatch(
                    "cybernexus:voice-error",
                    event || null
                );
            };

        recognition.onend =
            function () {
                Voice.listening =
                    false;

                updateButton();

                setStatus("");

                dispatch(
                    "cybernexus:voice-end"
                );
            };

        return recognition;
    }

    function initializeRecognition() {
        if (
            Voice.recognition
        ) {
            return Voice.recognition;
        }

        Voice.recognition =
            createRecognition();

        return Voice.recognition;
    }

    function startListening() {
        if (
            Voice.listening
        ) {
            return true;
        }

        if (
            Voice.speaking
        ) {
            stopSpeaking();
        }

        if (
            !Voice.recognition
        ) {
            initializeRecognition();
        }

        if (
            !Voice.recognition
        ) {
            setStatus(
                "Voice input is not supported by this browser."
            );

            dispatch(
                "cybernexus:voice-unsupported"
            );

            return false;
        }

        try {
            Voice.recognition.start();

            return true;
        } catch (error) {
            Voice.listening =
                false;

            updateButton();

            setStatus(
                "Unable to start voice input."
            );

            dispatch(
                "cybernexus:voice-error",
                error
            );

            return false;
        }
    }

    function stopListening() {
        if (
            !Voice.recognition
        ) {
            return false;
        }

        if (
            !Voice.listening
        ) {
            return false;
        }

        try {
            Voice.recognition.stop();

            return true;
        } catch (error) {
            Voice.listening =
                false;

            updateButton();

            setStatus("");

            dispatch(
                "cybernexus:voice-error",
                error
            );

            return false;
        }
    }

    function toggleListening() {
        return Voice.listening
            ? stopListening()
            : startListening();
    }

    /* ==========================================================================
       SPEECH SYNTHESIS
    ========================================================================== */

    function stopSpeaking() {
        const wasSpeaking =
            Voice.speaking;

        Voice.speechGeneration += 1;

        if (
            Voice.synthesis
        ) {
            Voice.synthesis.cancel();
        }

        Voice.speaking =
            false;

        if (
            wasSpeaking
        ) {
            setStatus("");

            dispatch(
                "cybernexus:speech-end"
            );
        }

        return wasSpeaking;
    }

    function getSpeechUtterance() {
        if (
            typeof window.SpeechSynthesisUtterance ===
            "undefined"
        ) {
            return null;
        }

        return window.SpeechSynthesisUtterance;
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

    function speak(
        text,
        options
    ) {
        const message =
            String(
                text || ""
            ).trim();

        if (!message) {
            return false;
        }

        if (
            !Voice.synthesis
        ) {
            setStatus(
                "Speech output is not supported by this browser."
            );

            dispatch(
                "cybernexus:speech-unsupported"
            );

            return false;
        }

        const Utterance =
            getSpeechUtterance();

        if (!Utterance) {
            setStatus(
                "Speech output is not supported by this browser."
            );

            dispatch(
                "cybernexus:speech-unsupported"
            );

            return false;
        }

        const value =
            options &&
            typeof options ===
                "object" &&
            !Array.isArray(options)
                ? options
                : {};

        if (
            Voice.listening
        ) {
            stopListening();
        }

        stopSpeaking();

        const generation =
            Voice.speechGeneration;

        const utterance =
            new Utterance(
                message
            );

        const rate =
            Number.isFinite(
                value.rate
            )
                ? value.rate
                : Voice.settings.rate;

        const pitch =
            Number.isFinite(
                value.pitch
            )
                ? value.pitch
                : Voice.settings.pitch;

        const volume =
            Number.isFinite(
                value.volume
            )
                ? value.volume
                : Voice.settings.volume;

        utterance.lang =
            typeof value.language ===
                "string" &&
            value.language.trim()
                ? value.language.trim()
                : Voice.settings.language;

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

        if (
            value.voice &&
            typeof value.voice ===
                "object"
        ) {
            utterance.voice =
                value.voice;
        }

        utterance.onstart =
            function () {
                if (
                    generation !==
                    Voice.speechGeneration
                ) {
                    return;
                }

                Voice.speaking =
                    true;

                setStatus(
                    "Speaking..."
                );

                dispatch(
                    "cybernexus:speech-start"
                );
            };

        utterance.onend =
            function () {
                if (
                    generation !==
                    Voice.speechGeneration
                ) {
                    return;
                }

                Voice.speaking =
                    false;

                setStatus("");

                dispatch(
                    "cybernexus:speech-end"
                );
            };

        utterance.onerror =
            function (event) {
                if (
                    generation !==
                    Voice.speechGeneration
                ) {
                    return;
                }

                Voice.speaking =
                    false;

                setStatus(
                    "Speech output error."
                );

                dispatch(
                    "cybernexus:speech-error",
                    event || null
                );
            };

        try {
            Voice.synthesis.speak(
                utterance
            );

            return true;
        } catch (error) {
            if (
                generation ===
                Voice.speechGeneration
            ) {
                Voice.speaking =
                    false;

                setStatus(
                    "Unable to start speech output."
                );

                dispatch(
                    "cybernexus:speech-error",
                    error
                );
            }

            return false;
        }
    }

    /* ==========================================================================
       SETTINGS
    ========================================================================== */

    function setLanguage(
        language
    ) {
        if (
            typeof language !==
                "string" ||
            !language.trim()
        ) {
            return Voice.settings
                .language;
        }

        Voice.settings.language =
            language.trim();

        if (
            Voice.recognition
        ) {
            Voice.recognition.lang =
                Voice.settings.language;
        }

        return Voice.settings
            .language;
    }

    function configure(
        options
    ) {
        const value =
            options &&
            typeof options ===
                "object" &&
            !Array.isArray(options)
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
            Voice.settings.continuous =
                value.continuous;
        }

        if (
            typeof value.interimResults ===
            "boolean"
        ) {
            Voice.settings.interimResults =
                value.interimResults;
        }

        if (
            Number.isFinite(
                value.rate
            )
        ) {
            Voice.settings.rate =
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
            Voice.settings.pitch =
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
            Voice.settings.volume =
                clamp(
                    value.volume,
                    0,
                    1
                );
        }

        if (
            Voice.recognition
        ) {
            Voice.recognition.lang =
                Voice.settings.language;

            Voice.recognition.continuous =
                Voice.settings.continuous;

            Voice.recognition.interimResults =
                Voice.settings.interimResults;
        }

        updateButton();

        return getSettings();
    }

    function getSettings() {
        return Object.assign(
            {},
            Voice.settings
        );
    }

    function isListening() {
        return Voice.listening;
    }

    function isSpeaking() {
        return Voice.speaking;
    }

    function isRecognitionSupported() {
        return Boolean(
            getRecognitionConstructor()
        );
    }

    function isSpeechSynthesisSupported() {
        return Boolean(
            Voice.synthesis &&
            typeof window.SpeechSynthesisUtterance !==
                "undefined"
        );
    }

    /* ==========================================================================
       BUTTON
    ========================================================================== */

    function initializeButton() {
        const button =
            getVoiceButton();

        if (!button) {
            return;
        }

        if (
            button.dataset.voiceBound ===
            "true"
        ) {
            updateButton();

            return;
        }

        button.dataset.voiceBound =
            "true";

        button.setAttribute(
            "type",
            "button"
        );

        button.addEventListener(
            "click",
            function (event) {
                event.preventDefault();

                toggleListening();
            }
        );

        updateButton();
    }

    /* ==========================================================================
       LIFECYCLE
    ========================================================================== */

    function initialize() {
        if (
            Voice.initialized
        ) {
            return;
        }

        initializeRecognition();
        initializeButton();

        Voice.initialized =
            true;

        dispatch(
            "cybernexus:voice-ready"
        );
    }

    function isInitialized() {
        return Voice.initialized;
    }

    /* ==========================================================================
       PUBLIC API
    ========================================================================== */

    const VoiceAPI =
        Object.freeze({
            initialize,
            isInitialized,

            startListening,
            stopListening,
            toggleListening,

            speak,
            stopSpeaking,

            configure,
            getSettings,
            setLanguage,

            isListening,
            isSpeaking,

            isRecognitionSupported,
            isSpeechSynthesisSupported
        });

    CyberNexus.Voice =
        VoiceAPI;

    window.CyberNexusVoice =
        VoiceAPI;

    /* ==========================================================================
       START
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
