window.handX = 450;
window.handY = 300;
window.isFist = false;
window.handTracked = false;
window.cameraReady = false;
let lostHandFrames = 0;

// 本文件内部使用的 clamp，避免依赖外部脚本作用域
function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}

const videoElement = document.getElementById("video");
const statusElement = document.getElementById("cameraStatus");

function setCameraPreviewVisible(visible) {
    if (!videoElement) {
        return;
    }
    videoElement.style.display = visible ? "block" : "none";
}

function setStatus(text, tone = "neutral") {
    if (!statusElement) {
        return;
    }
    statusElement.textContent = text;
    statusElement.dataset.tone = tone;
}

function detectFist(landmarks) {
    const tipIds = [4, 8, 12, 16, 20];
    const baseIds = [2, 5, 9, 13, 17];
    let totalDist = 0;

    for (let index = 0; index < 5; index += 1) {
        const tip = landmarks[tipIds[index]];
        const base = landmarks[baseIds[index]];
        totalDist += Math.hypot(tip.x - base.x, tip.y - base.y);
    }

    return (totalDist / 5) < 0.18;
}

function updateHandState(results) {
    const width = window.GAME_WIDTH || 900;
    const height = window.GAME_HEIGHT || 600;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const localIsFist = detectFist(landmarks);

        // 增强可达范围并根据设置调整灵敏度
        const margin = 0.05;
        const baseSensitivity = (window.settings && window.settings.sensitivity) ? Number(window.settings.sensitivity) : 1.0;
        const sensitivity = localIsFist ? baseSensitivity : 1.0;

        function normCoord(v) {
            const n = (v - margin) / (1 - 2 * margin);
            return clamp(n, 0, 1);
        }

        const nx = normCoord(indexTip.x);
        const ny = normCoord(indexTip.y);

        // 根据灵敏度扩大或缩小偏移
        const adjX = 0.5 + (nx - 0.5) * sensitivity;
        const adjY = 0.5 + (ny - 0.5) * sensitivity;

        const nextX = (1 - adjX) * width; // x 镜像
        const nextY = adjY * height;

        window.handX = window.handX * 0.45 + nextX * 0.55;
        window.handY = window.handY * 0.45 + nextY * 0.55;
        window.isFist = localIsFist;
        window.handTracked = true;
        lostHandFrames = 0;
    } else {
        lostHandFrames += 1;
        if (lostHandFrames > 6) {
            window.handTracked = false;
            window.isFist = false;
        }
    }
}

let hands = null;
let sendingFrame = false;

async function processFrame() {
    if (!hands || sendingFrame || !window.cameraReady) {
        return;
    }
    if (!videoElement || videoElement.readyState < 2) {
        return;
    }

    sendingFrame = true;
    try {
        await hands.send({ image: videoElement });
    } catch (error) {
        window.handTracked = false;
    } finally {
        sendingFrame = false;
    }
}

async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("当前浏览器不支持摄像头，已切换鼠标模式", "warn");
        return;
    }

    if (typeof Hands === "undefined") {
        setStatus("MediaPipe 加载失败，已切换鼠标模式", "warn");
        return;
    }

    try {
        hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`,
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.45,
            minTrackingConfidence: 0.45,
        });

        hands.onResults(updateHandState);

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 640,
                height: 480,
                facingMode: "user",
            },
            audio: false,
        });

        videoElement.srcObject = stream;
        videoElement.style.transform = "scaleX(-1)";
        setCameraPreviewVisible(!window.settings || window.settings.showCameraPreview !== false);
        await videoElement.play();
        window.cameraReady = true;
        setStatus("摄像头已连接", "ok");

        const ticker = () => {
            processFrame();
            window.requestAnimationFrame(ticker);
        };
        window.requestAnimationFrame(ticker);
    } catch (error) {
        window.cameraReady = false;
        setStatus("摄像头未授权，已切换鼠标模式", "warn");
    }
}

window.addEventListener("load", startCamera);

window.setCameraPreviewVisible = setCameraPreviewVisible;