// Ailment DMG Sub-stat rolls lookup configuration values map table
const ROLL_VALUES = {
    0: 9.6,    // Base sub-stat drop
    1: 19.2,   // 1 Roll
    2: 28.8,   // 2 Rolls
    3: 38.4,   // 3 Rolls
    4: 48.0    // 4 Rolls (Maxed)
};

// Globally track calculations to generate the modal snapshot breakdown
let currentConfigSnapshot = {};

// GLOBAL AUDIO ENGINE REFERENCE OBJECTS (SINGLETON PROTECTION)
let globalThemeAudio = null;
let activeGetsugaAudio = null;
let isMainThemeMuted = false;
let userHasInteracted = false;

// CRITICAL SECURE AUDIO BYPASS (Ensures only ONE instance ever spawns)
function handleFirstInteractionMusic() {
    if (userHasInteracted || isMainThemeMuted) return;
    
    // Check if the audio object already exists to prevent duplication
    if (!globalThemeAudio) {
        userHasInteracted = true;

        // Clean up unblocking listeners immediately
        window.removeEventListener('click', handleFirstInteractionMusic);
        window.removeEventListener('keydown', handleFirstInteractionMusic);
        window.removeEventListener('touchstart', handleFirstInteractionMusic);

        try {
            globalThemeAudio = new Audio('main-theme.mp3');
            globalThemeAudio.loop = true;
            globalThemeAudio.volume = 0.5; // Balanced low ambient background level
            globalThemeAudio.play().catch(err => {
                console.log("Browser safety blocked autoplay. Awaiting direct button tap.");
                // Reset flag so next interaction can try again if browser allowed
                userHasInteracted = false; 
            });
        } catch (err) {
            console.error("Audio block initialization failed:", err);
            userHasInteracted = false;
        }
    }
}

// MAIN PAGE AUDIO TOGGLE SWITCH MANAGER (Handles pure Mute/Unmute without overlapping)
function toggleMainMusic() {
    const soundIcon = document.getElementById('soundIconSymbol');

    // Case 1: Audio player doesn't exist yet (User clicks icon before typing anything)
    if (!globalThemeAudio) {
        userHasInteracted = true;
        try {
            globalThemeAudio = new Audio('main-theme.mp3');
            globalThemeAudio.loop = true;
            globalThemeAudio.volume = 0.5;
            globalThemeAudio.play();
            isMainThemeMuted = false;
            soundIcon.innerText = "🔊";
        } catch (err) {
            console.log("Audio creation blocked on button tap:", err);
        }
        return;
    }

    // Case 2: Audio player already exists, safely toggle playback states
    if (globalThemeAudio.paused) {
        globalThemeAudio.volume = 0.5;
        globalThemeAudio.play().catch(err => console.log("Playback error:", err));
        isMainThemeMuted = false;
        soundIcon.innerText = "🔊";
    } else {
        globalThemeAudio.pause();
        isMainThemeMuted = true;
        soundIcon.innerText = "🔇";
    }
}

function calculateStats() {
    // Safely attempt to start music only if it hasn't been initialized or muted yet
    handleFirstInteractionMusic();

    const passive = parseFloat(document.getElementById('passiveBonus').value) || 0;
    const weapon = parseFloat(document.getElementById('weaponStamp').value) || 0;
    const core = parseFloat(document.getElementById('coreStamp').value) || 0;
    const bond = parseFloat(document.getElementById('bondSet').value) || 0;
    const boundary = parseFloat(document.getElementById('boundaryBonus').value) || 0;
    const stampToggleActive = document.getElementById('stampToggle').checked;

    const TARGET_CAP = 214.28;
    const MAIN_STAT_STAMP = stampToggleActive ? 80.00 : 0.00;

    const SYSTEM_GAME_BASE = 0.00;

    // Total base calculations
    const totalBase = SYSTEM_GAME_BASE + passive + weapon + core + bond + boundary + MAIN_STAT_STAMP;
    let missing = TARGET_CAP - totalBase;
    if (missing < 0) missing = 0;

    // Cache the snapshot to pass directly into popup context blocks
    currentConfigSnapshot = {
        base: SYSTEM_GAME_BASE,
        passive: passive,
        weapon: weapon,
        core: core,
        bond: bond,
        boundary: boundary,
        stamp: MAIN_STAT_STAMP,
        totalBase: totalBase
    };

    document.getElementById('totalBaseBonus').innerText = totalBase.toFixed(2) + '%';
    document.getElementById('missingBonus').innerText = missing.toFixed(2) + '%';

    const safeListContainer = document.getElementById('safeDistributionsList');
    const trapListContainer = document.getElementById('trapDistributionsList');
    safeListContainer.innerHTML = '';
    trapListContainer.innerHTML = '';

    if (totalBase >= TARGET_CAP) {
        document.getElementById('minRollsValue').innerText = '0';
        safeListContainer.innerHTML = '<div class="dist-item safe-item" style="cursor:default;">Target cap reached via Base configuration values!</div>';
        return;
    }

    let optimalSolutions = [];
    let minimumTotalWeight = Infinity;

    // Evaluate combinations using the sub-stat configuration maps
    for (let s1 = 0; s1 <= 4; s1++) {
        for (let s2 = 0; s2 <= 4; s2++) {
            for (let s3 = 0; s3 <= 4; s3++) {
                
                let subStatTotal = ROLL_VALUES[s1] + ROLL_VALUES[s2] + ROLL_VALUES[s3];
                let finalValue = totalBase + subStatTotal;
                let currentWeight = s1 + s2 + s3;

                if (finalValue >= TARGET_CAP) {
                    if (currentWeight < minimumTotalWeight) {
                        minimumTotalWeight = currentWeight;
                        optimalSolutions = [];
                    }
                    if (currentWeight === minimumTotalWeight) {
                        optimalSolutions.push({
                            distribution: [s1, s2, s3].sort((a,b) => b-a),
                            totalValue: finalValue
                        });
                    }
                }
            }
        }
    }

    if (minimumTotalWeight === Infinity) {
        document.getElementById('minRollsValue').innerText = 'Impossible';
        safeListContainer.innerHTML = '<div class="dist-item trap-item" style="cursor:default;">Cannot reach 214.28% even with max sub-stat rolls!</div>';
        return;
    }

    document.getElementById('minRollsValue').innerText = minimumTotalWeight;

    // Deduplicate safe items
    let uniqueSafeStringArray = [];
    let uniqueSafeObjects = [];
    optimalSolutions.forEach(item => {
        let key = item.distribution.join(' / ');
        if (!uniqueSafeStringArray.includes(key)) {
            uniqueSafeStringArray.push(key);
            uniqueSafeObjects.push(item);
        }
    });

    // Capture matching trap combinations using the calculated minimum total rolls weight
    let uniqueTrapObjects = [];
    let uniqueTrapStringArray = [];

    for (let s1 = 0; s1 <= 4; s1++) {
        for (let s2 = 0; s2 <= 4; s2++) {
            for (let s3 = 0; s3 <= 4; s3++) {
                if ((s1 + s2 + s3) === minimumTotalWeight) {
                    let subStatTotal = ROLL_VALUES[s1] + ROLL_VALUES[s2] + ROLL_VALUES[s3];
                    let finalValue = totalBase + subStatTotal;

                    if (finalValue < TARGET_CAP) {
                        let sortedCombo = [s1, s2, s3].sort((a,b) => b-a);
                        let key = sortedCombo.join(' / ');
                        
                        if (!uniqueTrapStringArray.includes(key)) {
                            uniqueTrapStringArray.push(key);
                            uniqueTrapObjects.push({
                                distribution: sortedCombo,
                                totalValue: finalValue
                            });
                        }
                    }
                }
            }
        }
    }

    // Build the interactive list items inside the workspace
    uniqueSafeObjects.forEach(item => {
        const div = document.createElement('div');
        div.className = 'dist-item safe-item';
        div.innerHTML = `
            <div>${item.distribution.join('  /  ')}</div>
            <div class="dist-total">Total: <span>${item.totalValue.toFixed(2)}%</span></div>
        `;
        div.onclick = () => openModal(item.distribution, item.totalValue, true);
        safeListContainer.appendChild(div);
    });

    if (uniqueTrapObjects.length === 0) {
        trapListContainer.innerHTML = '<div class="dist-item" style="color: #444; cursor: default;">No trap layouts detected for this roll count.</div>';
    } else {
        uniqueTrapObjects.forEach(item => {
            const div = document.createElement('div');
            div.className = 'dist-item trap-item';
            div.innerHTML = `
                <div>${item.distribution.join('  /  ')}</div>
                <div class="dist-total">Total: <span>${item.totalValue.toFixed(2)}%</span></div>
            `;
            div.onclick = () => openModal(item.distribution, item.totalValue, false);
            trapListContainer.appendChild(div);
        });
    }
}

// ADVANCED WINDOW INTERACTIVE MODAL MANAGEMENT LOGIC ENGINE
function openModal(distributionArray, finalTotalPercent, isSafeBuild) {
    handleFirstInteractionMusic();

    const overlay = document.getElementById('modalOverlay');
    
    // Stop any previously playing voice lines if they exist before launching a new one
    if (activeGetsugaAudio) {
        activeGetsugaAudio.pause();
        activeGetsugaAudio.currentTime = 0;
    }

    // PLAY VOICE LINE EFFECT AUDIO FILE ON TRIGGER
    try {
        activeGetsugaAudio = new Audio('getsuga.mp3');
        activeGetsugaAudio.volume = 0.6; // Voice dialogue volume level
        activeGetsugaAudio.play();
    } catch(err) {
        console.log("Audio play blocked until initial browser window interaction event.");
    }
    
    // Fill text configuration properties
    document.getElementById('modalDistString').innerText = distributionArray.join(' / ');

// Pass the base configuration parameters
document.getElementById('mBase').innerText = currentConfigSnapshot.base.toFixed(2) + "%";
document.getElementById('mPassive').innerText = "+ " + currentConfigSnapshot.passive.toFixed(2) + "%";
document.getElementById('mWeapon').innerText = "+ " + currentConfigSnapshot.weapon.toFixed(2) + "%";
document.getElementById('mCore').innerText = "+ " + currentConfigSnapshot.core.toFixed(2) + "%";
document.getElementById('mBond').innerText = "+ " + currentConfigSnapshot.bond.toFixed(2) + "%";
document.getElementById('mBoundary').innerText = "+ " + currentConfigSnapshot.boundary.toFixed(2) + "%";
document.getElementById('mStamp').innerText = "+ " + currentConfigSnapshot.stamp.toFixed(2) + "%";
document.getElementById('mTotalBase').innerText = currentConfigSnapshot.totalBase.toFixed(2) + "%";
// Format individual sub-stat roll slots accurately matching layout indices
document.getElementById('mS1Rolls').innerText = distributionArray[0];
document.getElementById('mS2Rolls').innerText = distributionArray[1];
document.getElementById('mS3Rolls').innerText = distributionArray[2];
document.getElementById('mS1Value').innerText = "+ " + ROLL_VALUES[distributionArray[0]].toFixed(2) + "%";
document.getElementById('mS2Value').innerText = "+ " + ROLL_VALUES[distributionArray[1]].toFixed(2) + "%";
document.getElementById('mS3Value').innerText = "+ " + ROLL_VALUES[distributionArray[2]].toFixed(2) + "%";
document.getElementById('modalFinalResult').innerText = finalTotalPercent.toFixed(2) + "%";
// Open view state
overlay.style.display = 'flex';
}
function closeModal() {
document.getElementById('modalOverlay').style.display = 'none';
if (activeGetsugaAudio) {
activeGetsugaAudio.pause();
activeGetsugaAudio.currentTime = 0;
}
}
// Background close event register listener hook
window.onclick = function(event) {
const overlay = document.getElementById('modalOverlay');
if (event.target === overlay) {
closeModal();
}
}
// GLOBAL EVENT LISTENERS FOR SEAMLESS BACKGROUND AUDIO LOADING
window.addEventListener('click', handleFirstInteractionMusic, { once: true });
window.addEventListener('keydown', handleFirstInteractionMusic, { once: true });
window.addEventListener('touchstart', handleFirstInteractionMusic, { once: true });
// Initialize system matrix parsing loops
calculateStats();
