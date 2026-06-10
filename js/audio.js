const AudioEngine = (() => {
    const state = {
        context: null,
        unlocked: false,
        errorCount: 0,
        bgm: {
            mode: null,
            audio: null,
            currentUrl: null,
            token: 0,
        },
        musicVolume: 0.45,
        sfxVolume: 0.8,
    };

    // 默认的文件音效目录（放在 assets/sounds/sound-effects 下）
    const SFX_DIR = "assets/sounds/sound-effects/";

    function playEffectFile(url) {
        const context = ensureContext();
        if (!context) {
            // Fallback to HTMLAudio when WebAudio 不可用
            try {
                const a = new Audio(url);
                a.preload = "auto";
                a.volume = state.sfxVolume;
                a.play().catch(() => {});
            } catch (e) {}
            return;
        }

        try {
            const audio = new Audio(url);
            audio.preload = "auto";
            audio.volume = state.sfxVolume;
            audio.play().catch(() => {
                // 浏览器可能阻止自动播放，忽略错误
            });
        } catch (e) {
            // 忽略播放失败
        }
    }

    // 把背景音乐文件放在 assets/sounds 下面，例如：
    // assets/sounds/bgm/menu/menu-01.mp3
    // assets/sounds/bgm/classic/classic-01.mp3
    // assets/sounds/bgm/zen/zen-01.mp3
    // assets/sounds/bgm/arcade/arcade-01.mp3
    // 这里先用“文件路径数组”管理，后续只要把文件补齐就能随机播放。
    const BGM_LIBRARY = {
        menu: [
            "assets/sounds/bgm/menu/menu-01.mp3",
            "assets/sounds/bgm/menu/menu-02.mp3",
        ],
        dojo: [
            "assets/sounds/bgm/dojo/dojo-01.mp3",
        ],
        classic: [
            "assets/sounds/bgm/classic/classic-01.mp3",
            "assets/sounds/bgm/classic/classic-02.mp3",
        ],
        zen: [
            "assets/sounds/bgm/zen/zen-01.mp3",
            "assets/sounds/bgm/zen/zen-02.mp3",
        ],
        arcade: [
            "assets/sounds/bgm/arcade/arcade-01.mp3",
            "assets/sounds/bgm/arcade/arcade-02.mp3",
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
        state.errorCount = 0;
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
        state.errorCount = 0;

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
        audio.volume = state.musicVolume;

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
            state.errorCount += 1;
            if (playlistMode === "dojo" && state.errorCount >= 2) {
                playBgmTrack("menu");
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

        // 先保留已有的合成音效逻辑：slice, bomb, ui, start
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
                // 如果传入的是文件名或带扩展名的路径，尝试从 sound-effects 文件夹播放对应文件。
                // 支持三种形式：
                // 1) 直接传文件名（比如 "coin" -> assets/sounds/sound-effects/coin.mp3）
                // 2) 传带扩展名的文件名或相对路径（比如 "coin.wav" 或 "sounds/coin.mp3"）
                // 3) 以 "file:" 开头的完整路径（比如 "file:assets/.../coin.mp3"）

                const isFilePrefix = typeof type === "string" && type.indexOf("file:") === 0;
                const looksLikePath = typeof type === "string" && /\.(mp3|wav|ogg)$/i.test(type);

                if (isFilePrefix) {
                    playEffectFile(type.slice(5));
                    break;
                }

                if (looksLikePath) {
                    playEffectFile(type);
                    break;
                }

                if (typeof type === "string") {
                    // 尝试约定的 mp3 文件名
                    playEffectFile(SFX_DIR + type + ".mp3");
                    break;
                }

                // 回退成默认短音
                tone({ frequency: 440, duration: 0.05, type: "sine", gain: 0.04 });
        }

        // 未来如果需要可以把合成音效改成文件播放，或扩展 SFX 映射表。
    }

    // 高层音效接口：把选择逻辑放在这里，供外部调用
    function playHit() {
        if (!state.unlocked && !unlock()) return;
        if (window.settings && window.settings.muted) return;
        const idx = Math.floor(Math.random() * 6) + 1;
        playSound("命中" + idx);
    }

    function playBomb() {
        if (!state.unlocked && !unlock()) return;
        if (window.settings && window.settings.muted) return;
        playSound("炸弹爆炸F");
    }

    function playMiss() {
        if (!state.unlocked && !unlock()) return;
        if (window.settings && window.settings.muted) return;
        const idx = Math.random() < 0.5 ? "空刀1" : "空刀2";
        playSound(idx);
    }

    function playGameOver() {
        if (!state.unlocked && !unlock()) return;
        if (window.settings && window.settings.muted) return;
        playSound("游戏结束");
    }

    function playStart() {
        if (!state.unlocked && !unlock()) return;
        if (window.settings && window.settings.muted) return;
        // 保留合成 start 音，后续若有文件可用可改为文件播放
        playSound("start");
    }

    function setMusicVolume(v) {
        const value = Math.max(0, Math.min(1, Number(v) || 0));
        state.musicVolume = value;
        if (state.bgm && state.bgm.audio) {
            try { state.bgm.audio.volume = state.musicVolume; } catch (e) {}
        }
    }

    function setSfxVolume(v) {
        const value = Math.max(0, Math.min(1, Number(v) || 0));
        state.sfxVolume = value;
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

    return { playSound, playBgm, stopBgm, unlock, bindUnlockUI, state, playHit, playBomb, playMiss, playGameOver, playStart, setMusicVolume, setSfxVolume };
})();

window.playSound = AudioEngine.playSound;
window.playBgm = AudioEngine.playBgm;
window.stopBgm = AudioEngine.stopBgm;
window.unlockAudio = AudioEngine.unlock;
window.playHit = AudioEngine.playHit;
window.playBomb = AudioEngine.playBomb;
window.playMiss = AudioEngine.playMiss;
window.playGameOver = AudioEngine.playGameOver;
window.playStart = AudioEngine.playStart;
window.setMusicVolume = AudioEngine.setMusicVolume;
window.setSfxVolume = AudioEngine.setSfxVolume;

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