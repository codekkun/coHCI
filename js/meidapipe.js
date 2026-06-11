window.handX = 450;
window.handY = 300;
window.isFist = false;
window.isOpenPalm = false;
window.isOpenHand = false;
window.handTracked = false;
window.cameraReady = false;
window.snapTriggered = false;
window.snapX = 450;
window.snapY = 300;
window.faceState = "calm"; // calm | happy | sad | angry
window.faceStateCooldownUntil = 0;
let lostHandFrames = 0;
let snapPrimed = false;
let snapPrimedAt = 0;
let snapCloseDistance = Infinity;
let snapLastDistance = Infinity;
let snapLastTime = 0;
let snapCooldownUntil = 0;
const FIST_THRESHOLD = 0.13;

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

    return (totalDist / 5) < FIST_THRESHOLD;
}

function landmarkDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function analyzeOpenHand(landmarks) {
    const palmScale = getPalmScale(landmarks);
    const wrist = landmarks[0];
    const fingers = [
        { tip: 8, pip: 6, mcp: 5 },
        { tip: 12, pip: 10, mcp: 9 },
        { tip: 16, pip: 14, mcp: 13 },
        { tip: 20, pip: 18, mcp: 17 },
    ];

    let extendedCount = 0;
    fingers.forEach((finger) => {
        const tip = landmarks[finger.tip];
        const pip = landmarks[finger.pip];
        const mcp = landmarks[finger.mcp];
        const tipOutPastPip = landmarkDistance(tip, wrist) > landmarkDistance(pip, wrist) + palmScale * 0.12;
        const fingerLength = landmarkDistance(tip, mcp) > palmScale * 0.58;
        if (tipOutPastPip && fingerLength) {
            extendedCount += 1;
        }
    });

    const thumbTip = landmarks[4];
    const thumbIp = landmarks[3];
    const thumbBase = landmarks[2];
    const indexBase = landmarks[5];
    const thumbOpen =
        landmarkDistance(thumbTip, wrist) > landmarkDistance(thumbIp, wrist) + palmScale * 0.08 &&
        landmarkDistance(thumbTip, thumbBase) > palmScale * 0.42 &&
        landmarkDistance(thumbTip, indexBase) > palmScale * 0.36;
    if (thumbOpen) {
        extendedCount += 1;
    }

    const fingerSpread =
        (landmarkDistance(landmarks[8], landmarks[12]) +
            landmarkDistance(landmarks[12], landmarks[16]) +
            landmarkDistance(landmarks[16], landmarks[20])) /
        3;
    const thumbSpread = landmarkDistance(landmarks[4], landmarks[8]);
    const thumbMiddleSpread = landmarkDistance(landmarks[4], landmarks[12]);

    return {
        extendedCount,
        isOpenHand:
            extendedCount === 5 &&
            fingerSpread > palmScale * 0.22 &&
            thumbSpread > palmScale * 0.35 &&
            thumbMiddleSpread > palmScale * 0.52,
    };
}

function getPalmScale(landmarks) {
    const wrist = landmarks[0];
    const middleBase = landmarks[9];
    const indexBase = landmarks[5];
    const pinkyBase = landmarks[17];
    const palmHeight = Math.hypot(wrist.x - middleBase.x, wrist.y - middleBase.y);
    const palmWidth = Math.hypot(indexBase.x - pinkyBase.x, indexBase.y - pinkyBase.y);
    return Math.max(0.08, palmHeight, palmWidth);
}

function updateSnapState(landmarks, width, height, normCoord, openHandState) {
    const now = performance.now();
    const thumbTip = landmarks[4];
    const middleTip = landmarks[12];
    const palmScale = getPalmScale(landmarks);
    const distanceRatio = landmarkDistance(thumbTip, middleTip) / palmScale;
    const stableOpenHand = Boolean(openHandState && openHandState.isOpenHand);
    const snapBlocked =
        now < snapCooldownUntil ||
        now < (Number(window.gestureLockUntil) || 0);

    if (snapBlocked || (stableOpenHand && !snapPrimed)) {
        snapPrimed = false;
        window.snapTriggered = false;
        snapLastDistance = distanceRatio;
        snapLastTime = now;
        return;
    }

    const closeThreshold = 0.46;
    const openThreshold = 0.74;
    const minSeparation = 0.30;
    const minVelocity = 1.65;

    if (distanceRatio < closeThreshold) {
        if (!snapPrimed || distanceRatio < snapCloseDistance) {
            snapPrimed = true;
            snapPrimedAt = now;
            snapCloseDistance = distanceRatio;
        }
    } else if (snapPrimed) {
        const elapsed = now - snapPrimedAt;
        const frameSeconds = Math.max(0.016, (now - snapLastTime) / 1000);
        const velocity = (distanceRatio - snapLastDistance) / frameSeconds;
        const separatedEnough = distanceRatio > openThreshold && distanceRatio - snapCloseDistance > minSeparation;
        const timingLooksRight = elapsed >= 35 && elapsed <= 460;

        if (separatedEnough && timingLooksRight && velocity > minVelocity) {
            const snapMidX = (thumbTip.x + middleTip.x) / 2;
            const snapMidY = (thumbTip.y + middleTip.y) / 2;
            window.snapTriggered = true;
            window.snapX = (1 - normCoord(snapMidX)) * width;
            window.snapY = normCoord(snapMidY) * height;
            snapCooldownUntil = now + 1500;
            snapPrimed = false;
        } else if (elapsed > 560 || distanceRatio > 1.28) {
            snapPrimed = false;
        }
    }

    snapLastDistance = distanceRatio;
    snapLastTime = now;
}

function updateHandState(results) {
    const width = window.GAME_WIDTH || 900;
    const height = window.GAME_HEIGHT || 600;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const localIsFist = detectFist(landmarks);
        const openHandState = analyzeOpenHand(landmarks);

        // 增强可达范围并根据设置调整灵敏度
        const margin = 0.05;
        const baseSensitivity = (window.settings && window.settings.sensitivity) ? Number(window.settings.sensitivity) : 1.0;
        const adaptiveScale = Number(window.adaptiveSensitivityScale) || 1;
        const sensitivity = clamp(baseSensitivity * adaptiveScale, 0.55, 1.85);

        function normCoord(v) {
            const n = (v - margin) / (1 - 2 * margin);
            return clamp(n, 0, 1);
        }

        updateSnapState(landmarks, width, height, normCoord, openHandState);
        const localIsOpenHand = !localIsFist && !window.snapTriggered && !snapPrimed && openHandState.isOpenHand;

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
        window.isOpenPalm = localIsOpenHand;
        window.isOpenHand = localIsOpenHand;
        window.handTracked = true;
        lostHandFrames = 0;
        // 简易尝试：如果 faceLandmarker 可用，会在 face 回调中更新 faceState
    } else {
        lostHandFrames += 1;
        if (lostHandFrames > 6) {
            window.handTracked = false;
            window.isFist = false;
            window.isOpenPalm = false;
            window.isOpenHand = false;
            snapPrimed = false;
            window.snapTriggered = false;
        }
    }
}

// Face Landmarker integration (optional). If FaceLandmarker exists, use it; otherwise fall back to calm.
let faceLandmarker = null;
function detectFaceEmotionFromLandmarks(landmarks) {
    try {
        // FaceMesh-like indices: mouth corners ~61/291, upper/lower lip ~13/14, brow/eye approx indices
        const lM = landmarks[61];
        const rM = landmarks[291];
        const uLip = landmarks[13];
        const lLip = landmarks[14];
        const leftBrow = landmarks[70] || landmarks[55];
        const rightBrow = landmarks[300] || landmarks[285];
        const leftEyeTop = landmarks[159] || landmarks[145];
        const rightEyeTop = landmarks[386] || landmarks[374];

        if (!lM || !rM || !uLip || !lLip) return "calm";

        const mouthWidth = Math.hypot(rM.x - lM.x, rM.y - lM.y);
        const mouthOpen = uLip.y - lLip.y; // negative when open upwards
        const eyeOpenness = ((leftEyeTop.y + rightEyeTop.y) / 2) - ((uLip.y + lLip.y) / 2);

        // simple heuristics
        if (mouthWidth > 0.08 && mouthOpen < -0.01) {
            return "happy";
        }

        // sad: mouth corners droop (upper lip higher than lower lip) and eyes lower
        if (mouthOpen > 0.015) {
            return "sad";
        }

        // angry: brows lowered relative to eyes
        if (leftBrow && rightBrow && leftEyeTop) {
            const browY = (leftBrow.y + rightBrow.y) / 2;
            const eyeY = leftEyeTop.y;
            if (browY > eyeY + 0.008) return "angry";
        }

        return "calm";
    } catch (e) {
        return "calm";
    }
}

function updateFaceState(results) {
    const now = performance.now();
    if (!results) return;
    let landmarks = null;
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        landmarks = results.multiFaceLandmarks[0];
    } else if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        landmarks = results.faceLandmarks[0];
    }
    if (!landmarks) return;

    const newEmotion = detectFaceEmotionFromLandmarks(landmarks);
    if (newEmotion !== window.faceState && now > window.faceStateCooldownUntil) {
        window.faceState = newEmotion;
        window.faceStateCooldownUntil = now + 10000; // 10s cooldown
        // expose moment of change
        window.faceStateChangedAt = now;
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

        // Try to instantiate FaceLandmarker if available (optional). Guarded to avoid runtime errors.
        try {
            if (typeof FaceLandmarker !== 'undefined') {
                faceLandmarker = new FaceLandmarker({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_landmarker@0.0.1/${file}` });
                if (faceLandmarker && typeof faceLandmarker.setOptions === 'function') {
                    // best-effort options
                    faceLandmarker.setOptions?.({ maxNumFaces: 1 });
                }
                if (faceLandmarker && typeof faceLandmarker.onResults === 'function') {
                    faceLandmarker.onResults(updateFaceState);
                }
            }
        } catch (e) {
            faceLandmarker = null;
        }

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
            // if faceLandmarker exists, send frames to it too
            if (faceLandmarker && videoElement && videoElement.readyState >= 2) {
                try {
                    faceLandmarker.send({ image: videoElement });
                } catch (e) {
                    // ignore
                }
            }
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
