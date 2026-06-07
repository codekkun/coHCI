const AudioEngine = (() => {
    const state = {
        context: null,
        unlocked: false,
        bgm: {
            mode: null,
            audio: null,
            currentUrl: null,
            token: 0,
        },
    };

    // 把背景音乐文件放在 assets/sounds 下面，例如：
    // assets/sounds/bgm/menu/menu-01.mp3
    // assets/sounds/bgm/classic/classic-01.mp3
    // assets/sounds/bgm/zen/zen-01.mp3
    // assets/sounds/bgm/arcade/arcade-01.mp3
    // 这里先用“文件路径数组”管理，后续只要把文件补齐就能随机播放。
    const BGM_LIBRARY = {
        menu: [
            "assets/sounds/bgm/menu/menu-01.mp3",

        ],
        classic: [
            "assets/sounds/bgm/classic/classic-01.mp3",
  
        ],
        zen: [
            "assets/sounds/bgm/zen/zen-01.mp3",

        ],
        arcade: [
            "assets/sounds/bgm/arcade/arcade-01.mp3",

        ],
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

    function getPlaylist(mode) {
        return BGM_LIBRARY[mode] || BGM_LIBRARY.menu;
    }

    function pickRandomTrack(mode, avoidUrl = null) {
        const playlist = getPlaylist(mode).filter(Boolean);
        if (playlist.length === 0) {
            return null;
        }
        if (playlist.length === 1) {
            return playlist[0];
        }

        let next = playlist[Math.floor(Math.random() * playlist.length)];
        if (avoidUrl && next === avoidUrl) {
            next = playlist[(playlist.indexOf(next) + 1) % playlist.length];
        }
        return next;
    }

    function stopBgm() {
        state.bgm.token += 1;
        if (state.bgm.audio) {
            state.bgm.audio.pause();
            state.bgm.audio.onended = null;
            state.bgm.audio.onerror = null;
            state.bgm.audio.src = "";
            state.bgm.audio.load();
            state.bgm.audio = null;
        }
        state.bgm.mode = null;
        state.bgm.currentUrl = null;
    }

    function playBgmTrack(mode) {
        const context = ensureContext();
        if (!context) {
            return;
        }

        if (!state.unlocked && !unlock()) {
            return;
        }

        if (window.settings && window.settings.muted) {
            stopBgm();
            return;
        }

        const playlistMode = mode || "menu";

        // 同模式且正在播放时，不要重建实例，避免“重新开始”时 BGM 被打断。
        if (state.bgm.mode === playlistMode && state.bgm.audio && !state.bgm.audio.paused) {
            return;
        }

        const nextUrl = pickRandomTrack(playlistMode, state.bgm.currentUrl);
        if (!nextUrl) {
            return;
        }

        const token = state.bgm.token + 1;
        state.bgm.token = token;

        if (state.bgm.audio) {
            state.bgm.audio.pause();
            state.bgm.audio.onended = null;
            state.bgm.audio.onerror = null;
            state.bgm.audio.src = "";
            state.bgm.audio.load();
        }

        const audio = new Audio(nextUrl);
        audio.preload = "auto";
        audio.loop = false;
        audio.volume = 0.45;

        audio.addEventListener("ended", () => {
            if (state.bgm.mode !== playlistMode || state.bgm.token !== token) {
                return;
            }
            playBgmTrack(playlistMode);
        });

        audio.addEventListener("error", () => {
            // 如果某个文件暂时不存在，直接换下一首，不打断流程。
            if (state.bgm.mode !== playlistMode || state.bgm.token !== token) {
                return;
            }
            playBgmTrack(playlistMode);
        });

        audio.play().catch(() => {
            // 浏览器拦截自动播放时不报错，等用户交互后再触发播放。
        });

        state.bgm.mode = playlistMode;
        state.bgm.currentUrl = nextUrl;
        state.bgm.audio = audio;
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

    function playBgm(mode) {
        playBgmTrack(mode || "menu");
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

        // 未来如果要把音效也改成文件播放，可以在这里加对应分支：
        // case "slice": playEffectFile("assets/sounds/sfx/slice.mp3"); break;
        // case "bomb": playEffectFile("assets/sounds/sfx/bomb.mp3"); break;
        // case "ui": playEffectFile("assets/sounds/sfx/ui.mp3"); break;
        // 目前先保留原来的合成音效逻辑，避免影响现有体验。
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

    return { playSound, playBgm, stopBgm, unlock, bindUnlockUI, state };
})();

window.playSound = AudioEngine.playSound;
window.playBgm = AudioEngine.playBgm;
window.stopBgm = AudioEngine.stopBgm;
window.unlockAudio = AudioEngine.unlock;

window.addEventListener("DOMContentLoaded", () => {
    AudioEngine.bindUnlockUI();
});

// 允许外部设置静音
window.setMuted = function (m) {
    if (!window.settings) window.settings = {};
    window.settings.muted = !!m;
    if (window.settings.muted && window.stopBgm) {
        window.stopBgm();
    }
};