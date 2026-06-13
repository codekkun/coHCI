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
window.snapTriggeredAt = 0;
window.snapHandIndex = 0;
window.handPointers = [];
window.faceState = "unknown";
window.faceConfidence = 0;
window.faceDetectionReady = false;
window.faceDetectionEnabled = true;
window.faceExpressionMix = { calm: 1, focused: 0, happy: 0, surprised: 0 };
window.faceExpressionScores = {};
window.faceStateChangedAt = 0;
window.faceSampleUpdatedAt = 0;
let lostHandFrames = 0;
const MAX_HAND_POINTERS = 2;
const SNAP_EVENT_TTL_MS = 450;
const snapStates = Array.from({ length: MAX_HAND_POINTERS }, () => createSnapState());
const FIST_THRESHOLD = 0.13;
const FACE_SAMPLE_INTERVAL_MS = 360;
const FACE_MISSING_TIMEOUT_MS = 1600;
const FACE_HISTORY_MS = 2200;
const FACE_STATES = ["calm", "focused", "happy", "surprised"];
const FACE_LABELS = {
    unknown: "未检测",
    calm: "平稳",
    focused: "专注",
    happy: "开心",
    surprised: "惊讶",
    off: "关闭",
};

// 本文件内部使用的 clamp，避免依赖外部脚本作用域
function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}

const videoElement = document.getElementById("video");
const statusElement = document.getElementById("cameraStatus");
const emotionStatusElement = document.getElementById("emotionStatus");

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

function getFaceStateLabel(state) {
    return FACE_LABELS[state] || FACE_LABELS.unknown;
}

function normalizeFaceScores(scores) {
    const clean = {};
    let total = 0;
    FACE_STATES.forEach((state) => {
        const value = Math.max(0, Number(scores[state]) || 0);
        clean[state] = value;
        total += value;
    });
    if (total <= 0) {
        return FACE_STATES.reduce((mix, state) => {
            mix[state] = state === "calm" ? 1 : 0;
            return mix;
        }, {});
    }
    return FACE_STATES.reduce((mix, state) => {
        mix[state] = clean[state] / total;
        return mix;
    }, {});
}

function getTopFaceMixEntries(mix, limit = 2) {
    return FACE_STATES
        .map((state) => ({ state, value: Number(mix && mix[state]) || 0 }))
        .filter((entry) => entry.value >= 0.015)
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
}

function isFaceDetectionEnabled() {
    return Boolean(window.faceDetectionEnabled && (!window.settings || window.settings.faceDetection !== false));
}

function setEmotionStatus(text, state = "unknown") {
    if (!emotionStatusElement) {
        return;
    }
    emotionStatusElement.textContent = text;
    emotionStatusElement.dataset.state = state;
}

function updateEmotionStatus() {
    if (!isFaceDetectionEnabled()) {
        setEmotionStatus("表情：关闭", "off");
        return;
    }
    if (!window.faceDetectionReady) {
        setEmotionStatus("表情：模型加载中", "unknown");
        return;
    }
    const state = window.faceState || "unknown";
    const topEntries = getTopFaceMixEntries(window.faceExpressionMix, 2);
    if (state !== "unknown" && topEntries.length) {
        const mixText = topEntries
            .map((entry) => `${getFaceStateLabel(entry.state)} ${Math.round(entry.value * 100)}%`)
            .join(" · ");
        setEmotionStatus(`表情：${mixText}`, state);
        return;
    }
    setEmotionStatus("表情：未检测", "unknown");
}

function resetFaceState(state = "unknown") {
    window.faceState = state;
    window.faceConfidence = 0;
    window.faceExpressionMix = { calm: 1, focused: 0, happy: 0, surprised: 0 };
    window.faceExpressionScores = {};
    window.faceStateChangedAt = performance.now();
    updateEmotionStatus();
}

function setFaceDetectionEnabled(enabled) {
    window.faceDetectionEnabled = Boolean(enabled);
    if (!window.faceDetectionEnabled) {
        resetFaceState("unknown");
        setEmotionStatus("表情：关闭", "off");
    } else {
        updateEmotionStatus();
    }
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

function createSnapState() {
    return {
        primed: false,
        primedAt: 0,
        closeStableSince: 0,
        closePoseValid: false,
        closeDistance: Infinity,
        lastDistance: Infinity,
        lastTime: 0,
        cooldownUntil: 0,
    };
}

function resetSnapState(state) {
    state.primed = false;
    state.primedAt = 0;
    state.closeStableSince = 0;
    state.closePoseValid = false;
    state.closeDistance = Infinity;
}

function resetAllSnapStates() {
    snapStates.forEach(resetSnapState);
}

function expireSnapTrigger(now) {
    if (window.snapTriggered && now - (Number(window.snapTriggeredAt) || 0) > SNAP_EVENT_TTL_MS) {
        window.snapTriggered = false;
    }
}

function isFingerExtended(landmarks, finger, palmScale, wrist) {
    const tip = landmarks[finger.tip];
    const pip = landmarks[finger.pip];
    const mcp = landmarks[finger.mcp];
    return (
        landmarkDistance(tip, wrist) > landmarkDistance(pip, wrist) + palmScale * 0.10 &&
        landmarkDistance(tip, mcp) > palmScale * 0.54
    );
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

function analyzeSnapIntent(landmarks, palmScale, distanceRatio, openHandState) {
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const indexExtended = isFingerExtended(landmarks, { tip: 8, pip: 6, mcp: 5 }, palmScale, wrist);
    const thumbIndexRatio = landmarkDistance(thumbTip, indexTip) / palmScale;
    const thumbRingRatio = landmarkDistance(thumbTip, ringTip) / palmScale;
    const middleCurlRatio = landmarkDistance(middleTip, landmarks[9]) / palmScale;
    const middleIsPrimary =
        distanceRatio < thumbIndexRatio * 0.86 &&
        distanceRatio < thumbRingRatio + 0.10;
    const middleBentEnough = middleCurlRatio < 0.86 || landmarkDistance(middleTip, landmarks[10]) < palmScale * 0.34;
    const notWideOpen = !openHandState || (openHandState.extendedCount <= 3 && !openHandState.isOpenHand);

    return {
        canPrime:
            notWideOpen &&
            indexExtended &&
            middleIsPrimary &&
            middleBentEnough &&
            thumbIndexRatio > 0.40,
        canRelease:
            notWideOpen &&
            indexExtended &&
            thumbIndexRatio > 0.38,
    };
}

function updateSnapState(landmarks, width, height, normCoord, openHandState, state, handIndex) {
    const now = performance.now();
    expireSnapTrigger(now);
    const thumbTip = landmarks[4];
    const middleTip = landmarks[12];
    const palmScale = getPalmScale(landmarks);
    const distanceRatio = landmarkDistance(thumbTip, middleTip) / palmScale;
    const snapIntent = analyzeSnapIntent(landmarks, palmScale, distanceRatio, openHandState);
    const stableOpenHand = Boolean(openHandState && (openHandState.isOpenHand || openHandState.extendedCount >= 4));
    const snapBlocked =
        now < state.cooldownUntil ||
        now < (Number(window.gestureLockUntil) || 0);

    if (snapBlocked || (stableOpenHand && !state.primed)) {
        resetSnapState(state);
        state.lastDistance = distanceRatio;
        state.lastTime = now;
        return;
    }

    const closeThreshold = 0.38;
    const openThreshold = 0.78;
    const minSeparation = 0.36;
    const minVelocity = 2.35;
    const minClosedMs = 55;
    const maxSnapMs = 430;

    if (distanceRatio < closeThreshold && snapIntent.canPrime) {
        if (!state.primed) {
            state.primed = true;
            state.primedAt = now;
            state.closeStableSince = now;
            state.closePoseValid = true;
            state.closeDistance = distanceRatio;
        } else {
            state.closeDistance = Math.min(state.closeDistance, distanceRatio);
            state.closePoseValid = state.closePoseValid && snapIntent.canPrime;
        }
    } else if (state.primed) {
        const elapsed = now - state.primedAt;
        const closedMs = state.closeStableSince ? now - state.closeStableSince : 0;
        const frameSeconds = Math.max(0.016, (now - state.lastTime) / 1000);
        const velocity = (distanceRatio - state.lastDistance) / frameSeconds;
        const separatedEnough =
            snapIntent.canRelease &&
            distanceRatio > openThreshold &&
            distanceRatio - state.closeDistance > minSeparation;
        const timingLooksRight = closedMs >= minClosedMs && elapsed <= maxSnapMs;

        if (state.closePoseValid && separatedEnough && timingLooksRight && velocity > minVelocity) {
            const snapMidX = (thumbTip.x + middleTip.x) / 2;
            const snapMidY = (thumbTip.y + middleTip.y) / 2;
            window.snapTriggered = true;
            window.snapTriggeredAt = now;
            window.snapHandIndex = handIndex;
            window.snapX = (1 - normCoord(snapMidX)) * width;
            window.snapY = normCoord(snapMidY) * height;
            state.cooldownUntil = now + 1500;
            resetSnapState(state);
        } else if (elapsed > 560 || distanceRatio > 1.20 || stableOpenHand || (distanceRatio < closeThreshold && !snapIntent.canPrime)) {
            resetSnapState(state);
        }
    }

    state.lastDistance = distanceRatio;
    state.lastTime = now;
}

function updateHandState(results) {
    const width = window.GAME_WIDTH || 900;
    const height = window.GAME_HEIGHT || 600;
    const now = performance.now();
    expireSnapTrigger(now);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const margin = 0.05;
        const baseSensitivity = (window.settings && window.settings.sensitivity) ? Number(window.settings.sensitivity) : 1.0;
        const adaptiveScale = Number(window.adaptiveSensitivityScale) || 1;
        const sensitivity = clamp(baseSensitivity * adaptiveScale, 0.55, 1.85);

        function normCoord(v) {
            const n = (v - margin) / (1 - 2 * margin);
            return clamp(n, 0, 1);
        }

        const previousPointers = Array.isArray(window.handPointers) ? window.handPointers : [];
        const detectedPointers = results.multiHandLandmarks
            .slice(0, MAX_HAND_POINTERS)
            .map((landmarks, sourceIndex) => {
                const indexTip = landmarks[8];
                const localIsFist = detectFist(landmarks);
                const openHandState = analyzeOpenHand(landmarks);
                const snapState = snapStates[sourceIndex] || snapStates[0];
                updateSnapState(landmarks, width, height, normCoord, openHandState, snapState, sourceIndex);
                const localIsOpenHand = !localIsFist && !snapState.primed && openHandState.isOpenHand;

                const nx = normCoord(indexTip.x);
                const ny = normCoord(indexTip.y);
                const adjX = 0.5 + (nx - 0.5) * sensitivity;
                const adjY = 0.5 + (ny - 0.5) * sensitivity;

                return {
                    x: clamp((1 - adjX) * width, 0, width),
                    y: clamp(adjY * height, 0, height),
                    fist: localIsFist,
                    openHand: localIsOpenHand,
                    sourceIndex,
                };
            })
            .sort((a, b) => a.x - b.x)
            .map((point, playerIndex) => {
                const previous = previousPointers[playerIndex];
                const hasPrevious =
                    previous &&
                    Number.isFinite(previous.x) &&
                    Number.isFinite(previous.y);
                return {
                    x: hasPrevious ? previous.x * 0.45 + point.x * 0.55 : point.x,
                    y: hasPrevious ? previous.y * 0.45 + point.y * 0.55 : point.y,
                    fist: point.fist,
                    openHand: point.openHand,
                    sourceIndex: point.sourceIndex,
                    playerIndex,
                };
            });

        window.handPointers = detectedPointers;
        const primaryPointer = detectedPointers[0];
        if (primaryPointer) {
            window.handX = primaryPointer.x;
            window.handY = primaryPointer.y;
            window.isFist = primaryPointer.fist;
            window.isOpenPalm = primaryPointer.openHand;
            window.isOpenHand = primaryPointer.openHand;
            window.handTracked = true;
        }
        lostHandFrames = 0;
    } else {
        lostHandFrames += 1;
        if (lostHandFrames > 6) {
            window.handPointers = [];
            window.handTracked = false;
            window.isFist = false;
            window.isOpenPalm = false;
            window.isOpenHand = false;
            resetAllSnapStates();
            window.snapTriggered = false;
        }
    }
}

let faceMesh = null;
let faceObservationHistory = [];
let lastFaceSeenAt = 0;

function getFacePoint(landmarks, index) {
    const point = landmarks[index];
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return null;
    }
    return point;
}

function facePointDistance(a, b) {
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function averageFaceY(landmarks, indices) {
    let total = 0;
    let count = 0;
    indices.forEach((index) => {
        const point = getFacePoint(landmarks, index);
        if (point) {
            total += point.y;
            count += 1;
        }
    });
    return count ? total / count : null;
}

function getFaceScale(landmarks) {
    const cheekWidth = facePointDistance(getFacePoint(landmarks, 234), getFacePoint(landmarks, 454));
    const eyeWidth = facePointDistance(getFacePoint(landmarks, 33), getFacePoint(landmarks, 263)) * 2.25;
    const mouthWidth = facePointDistance(getFacePoint(landmarks, 61), getFacePoint(landmarks, 291)) * 3.2;
    return Math.max(0.16, cheekWidth || 0, eyeWidth || 0, mouthWidth || 0);
}

function detectFaceExpressionMix(landmarks) {
    try {
        const leftMouth = getFacePoint(landmarks, 61);
        const rightMouth = getFacePoint(landmarks, 291);
        const upperLip = getFacePoint(landmarks, 13);
        const lowerLip = getFacePoint(landmarks, 14);

        if (!leftMouth || !rightMouth || !upperLip || !lowerLip) {
            return { state: "unknown", confidence: 0, scores: {}, mix: normalizeFaceScores({ calm: 1 }) };
        }

        const faceScale = getFaceScale(landmarks);
        const mouthWidth = facePointDistance(leftMouth, rightMouth) / faceScale;
        const mouthOpen = facePointDistance(upperLip, lowerLip) / faceScale;
        const lipCenterY = (upperLip.y + lowerLip.y) / 2;
        const mouthCornerY = (leftMouth.y + rightMouth.y) / 2;
        const cornerLift = (lipCenterY - mouthCornerY) / faceScale;
        const eyeOpen =
            (facePointDistance(getFacePoint(landmarks, 159), getFacePoint(landmarks, 145)) +
                facePointDistance(getFacePoint(landmarks, 386), getFacePoint(landmarks, 374))) /
            (2 * faceScale);
        const browY = averageFaceY(landmarks, [70, 105, 336, 300]);
        const eyeTopY = averageFaceY(landmarks, [159, 386]);
        const browGap = browY !== null && eyeTopY !== null ? (eyeTopY - browY) / faceScale : 0.065;

        const happyScore =
            0.08 +
            clamp((mouthWidth - 0.30) / 0.12, 0, 1) * 0.38 +
            clamp((cornerLift - 0.003) / 0.032, 0, 1) * 0.42 +
            clamp((mouthOpen - 0.012) / 0.050, 0, 1) * 0.12;
        const surprisedScore =
            0.04 +
            clamp((mouthOpen - 0.040) / 0.090, 0, 1) * 0.66 +
            clamp((eyeOpen - 0.020) / 0.034, 0, 1) * 0.24 +
            clamp((browGap - 0.080) / 0.050, 0, 1) * 0.10;
        const browLowerSignal = clamp((0.083 - browGap) / 0.070, 0, 1);
        const eyeNarrowSignal = clamp((0.036 - eyeOpen) / 0.032, 0, 1);
        const mouthSetSignal = clamp((0.052 - mouthOpen) / 0.052, 0, 1);
        const mouthNarrowSignal = clamp((0.390 - mouthWidth) / 0.160, 0, 1);
        const focusedScore = clamp(
            0.18 +
            browLowerSignal * 0.34 +
            eyeNarrowSignal * 0.22 +
            mouthSetSignal * 0.18 +
            mouthNarrowSignal * 0.10 -
            happyScore * 0.18 -
            surprisedScore * 0.36,
            0,
            1
        );
        const expressivePeak = Math.max(happyScore, surprisedScore, focusedScore);
        const calmScore = clamp(0.72 - expressivePeak * 0.42 + mouthSetSignal * 0.10, 0.24, 0.80);
        const scores = {
            calm: calmScore,
            focused: focusedScore,
            happy: happyScore,
            surprised: surprisedScore,
        };
        const mix = normalizeFaceScores(scores);
        let state = "calm";
        let confidence = mix.calm;
        FACE_STATES.forEach((candidate) => {
            if (mix[candidate] > confidence) {
                state = candidate;
                confidence = mix[candidate];
            }
        });

        return { state, confidence, scores, mix };
    } catch (error) {
        return { state: "unknown", confidence: 0, scores: {}, mix: normalizeFaceScores({ calm: 1 }) };
    }
}

function smoothFaceObservation(observation, now) {
    faceObservationHistory.push({
        mix: observation.mix,
        confidence: observation.confidence,
        t: now,
    });
    faceObservationHistory = faceObservationHistory.filter((item) => now - item.t <= FACE_HISTORY_MS);

    const totals = {};
    let totalWeight = 0;
    faceObservationHistory.forEach((item) => {
        const ageWeight = clamp(1 - (now - item.t) / FACE_HISTORY_MS, 0.25, 1);
        const weight = Math.max(0.18, item.confidence) * ageWeight;
        FACE_STATES.forEach((state) => {
            totals[state] = (totals[state] || 0) + (Number(item.mix && item.mix[state]) || 0) * weight;
        });
        totalWeight += weight;
    });

    const stableMix = {};
    FACE_STATES.forEach((state) => {
        stableMix[state] = totalWeight ? (totals[state] || 0) / totalWeight : (observation.mix[state] || 0);
    });
    const mix = normalizeFaceScores(stableMix);
    let state = "calm";
    let confidence = mix.calm;
    FACE_STATES.forEach((candidate) => {
        if (mix[candidate] > confidence) {
            state = candidate;
            confidence = mix[candidate];
        }
    });
    return { state, confidence, mix };
}

function updateFaceState(results) {
    const now = performance.now();
    if (!isFaceDetectionEnabled()) {
        updateEmotionStatus();
        return;
    }
    if (!results) return;

    let landmarks = null;
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        landmarks = results.multiFaceLandmarks[0];
    } else if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        landmarks = results.faceLandmarks[0];
    }

    if (!landmarks) {
        if (lastFaceSeenAt && now - lastFaceSeenAt > FACE_MISSING_TIMEOUT_MS) {
            faceObservationHistory = [];
            resetFaceState("unknown");
        }
        return;
    }

    lastFaceSeenAt = now;
    const observation = detectFaceExpressionMix(landmarks);
    const stable = smoothFaceObservation(observation, now);

    window.faceExpressionScores = observation.scores || {};
    window.faceExpressionMix = stable.mix || observation.mix || normalizeFaceScores({ calm: 1 });
    window.faceConfidence = stable.confidence;
    window.faceSampleUpdatedAt = now;
    if (stable.state !== window.faceState) {
        window.faceState = stable.state;
        window.faceStateChangedAt = now;
    }
    updateEmotionStatus();
}

function initFaceMesh() {
    if (typeof FaceMesh === "undefined") {
        faceMesh = null;
        window.faceDetectionReady = false;
        setEmotionStatus("表情：模型未加载", "unknown");
        return;
    }

    try {
        faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
        });
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.50,
            minTrackingConfidence: 0.50,
        });
        faceMesh.onResults(updateFaceState);
        window.faceDetectionReady = true;
        updateEmotionStatus();
    } catch (error) {
        faceMesh = null;
        window.faceDetectionReady = false;
        setEmotionStatus("表情：模型未加载", "unknown");
    }
}

let hands = null;
let sendingFrame = false;
let sendingFaceFrame = false;
let lastFaceFrameAt = 0;

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

async function processFaceFrame(now = performance.now()) {
    if (!faceMesh || sendingFaceFrame || !window.cameraReady || !isFaceDetectionEnabled()) {
        return;
    }
    if (!videoElement || videoElement.readyState < 2) {
        return;
    }
    if (now - lastFaceFrameAt < FACE_SAMPLE_INTERVAL_MS) {
        return;
    }

    sendingFaceFrame = true;
    lastFaceFrameAt = now;
    try {
        await faceMesh.send({ image: videoElement });
    } catch (error) {
        faceObservationHistory = [];
        resetFaceState("unknown");
    } finally {
        sendingFaceFrame = false;
    }
}

async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("当前浏览器不支持摄像头，已切换鼠标模式", "warn");
        setCameraPreviewVisible(false);
        return;
    }

    if (typeof Hands === "undefined") {
        setStatus("MediaPipe 加载失败，已切换鼠标模式", "warn");
        setCameraPreviewVisible(false);
        return;
    }

    try {
        hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`,
        });

        hands.setOptions({
            maxNumHands: MAX_HAND_POINTERS,
            modelComplexity: 1,
            minDetectionConfidence: 0.45,
            minTrackingConfidence: 0.45,
        });

        hands.onResults(updateHandState);
        initFaceMesh();

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
        updateEmotionStatus();

        const ticker = () => {
            const now = performance.now();
            processFrame();
            processFaceFrame(now);
            window.requestAnimationFrame(ticker);
        };
        window.requestAnimationFrame(ticker);
    } catch (error) {
        window.cameraReady = false;
        setStatus("摄像头未授权，已切换鼠标模式", "warn");
        setCameraPreviewVisible(false);
        setEmotionStatus("表情：等待摄像头", "unknown");
    }
}

window.addEventListener("load", startCamera);

window.setCameraPreviewVisible = setCameraPreviewVisible;
window.setFaceDetectionEnabled = setFaceDetectionEnabled;
window.getFaceStateLabel = getFaceStateLabel;
window.getFaceStatusSnapshot = () => ({
    state: window.faceState || "unknown",
    label: getFaceStateLabel(window.faceState || "unknown"),
    confidence: Number(window.faceConfidence) || 0,
    enabled: isFaceDetectionEnabled(),
    ready: Boolean(window.faceDetectionReady),
    updatedAt: Number(window.faceSampleUpdatedAt) || 0,
    scores: Object.assign({}, window.faceExpressionScores || {}),
    mix: Object.assign({}, window.faceExpressionMix || {}),
});
