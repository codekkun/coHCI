const AudioEngine = (() => {
    const state = {
        context: null,
        unlocked: false,
    };

    function ensureContext() {
        if (!state.context) {
            const AudioCtor = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtor) {
                return null;
            }
            state.context = new AudioCtor();
        }
        return state.context;
    }

    function tone({ frequency, duration, type = "sine", gain = 0.08, sweepTo = null }) {
        const context = ensureContext();
        if (!context) {
            return;
        }

        const oscillator = context.createOscillator();
        const volume = context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, context.currentTime);
        if (sweepTo !== null) {
            oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), context.currentTime + duration);
        }
        volume.gain.setValueAtTime(0.0001, context.currentTime);
        volume.gain.exponentialRampToValueAtTime(gain, context.currentTime + 0.02);
        volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
        oscillator.connect(volume);
        volume.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + duration + 0.03);
    }

    function unlock() {
        const context = ensureContext();
        if (!context) {
            return false;
        }
        if (context.state === "suspended") {
            context.resume();
        }
        state.unlocked = true;
        return true;
    }

    function playSound(type) {
        if (!state.unlocked && !unlock()) {
            return;
        }
        if (window.settings && window.settings.muted) return;

        switch (type) {
            case "slice":
                tone({ frequency: 660, duration: 0.08, type: "triangle", gain: 0.07, sweepTo: 980 });
                break;
            case "bomb":
                tone({ frequency: 120, duration: 0.22, type: "sawtooth", gain: 0.12, sweepTo: 44 });
                break;
            case "ui":
                tone({ frequency: 520, duration: 0.06, type: "sine", gain: 0.05, sweepTo: 780 });
                break;
            case "start":
                tone({ frequency: 392, duration: 0.09, type: "triangle", gain: 0.06, sweepTo: 784 });
                break;
            default:
                tone({ frequency: 440, duration: 0.05, type: "sine", gain: 0.04 });
        }
    }

    function bindUnlockUI() {
        const button = document.getElementById("audioUnlock");
        if (!button) {
            return;
        }

        const setButtonState = () => {
            button.textContent = state.unlocked ? "声音已启用" : "启用声音";
            button.disabled = state.unlocked;
            button.style.opacity = state.unlocked ? "0.7" : "1";
            button.style.cursor = state.unlocked ? "default" : "pointer";
        };

        button.addEventListener("click", () => {
            unlock();
            setButtonState();
        });

        window.addEventListener("pointerdown", unlock, { passive: true });
        window.addEventListener("keydown", unlock, { passive: true });
        setButtonState();
    }

    return { playSound, unlock, bindUnlockUI, state };
})();

window.playSound = AudioEngine.playSound;
window.unlockAudio = AudioEngine.unlock;

window.addEventListener("DOMContentLoaded", () => {
    AudioEngine.bindUnlockUI();
});

// 允许外部设置静音
window.setMuted = function (m) {
    if (!window.settings) window.settings = {};
    window.settings.muted = !!m;
};