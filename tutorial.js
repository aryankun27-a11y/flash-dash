// Flash Dash - Interactive Onboarding Tutorial (tutorial.js)
// Guides first-time users through the dashboard's features with step-by-step spotlights and cozy whiteboard annotations.

(function () {
  const overlay = document.getElementById('tutorialOverlay');
  const cutout = document.getElementById('tutorialSpotlightCutout');
  const arrowPath = document.getElementById('tutorialArrowPath');
  const tooltip = document.getElementById('tutorialTooltip');
  const stepIndicator = document.getElementById('tutorialStepIndicator');
  const titleEl = document.getElementById('tutorialTitle');
  const textEl = document.getElementById('tutorialText');
  const skipBtn = document.getElementById('tutorialSkipBtn');
  const nextBtn = document.getElementById('tutorialNextBtn');

  if (!overlay || !cutout || !arrowPath || !tooltip) {
    console.warn("Flash Dash Tutorial: Missing DOM elements. Onboarding tutorial disabled.");
    return;
  }

  let currentStep = 0;
  let activeTarget = null;
  let resizeTimeout = null;

  let animFrameId = null;
  let currentCutoutState = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    w: 0,
    h: 0,
    r: 0
  };

  function animateCutoutTo(targetX, targetY, targetW, targetH, targetR) {
    if (animFrameId) cancelAnimationFrame(animFrameId);

    const duration = 300; // Snappy 300ms transition
    const startTime = performance.now();

    const startX = currentCutoutState.x;
    const startY = currentCutoutState.y;
    const startW = currentCutoutState.w;
    const startH = currentCutoutState.h;
    const startR = currentCutoutState.r;

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Easing: easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);

      const x = startX + (targetX - startX) * ease;
      const y = startY + (targetY - startY) * ease;
      const w = startW + (targetW - startW) * ease;
      const h = startH + (targetH - startH) * ease;
      const r = startR + (targetR - startR) * ease;

      currentCutoutState = { x, y, w, h, r };

      if (cutout) {
        cutout.setAttribute('x', x);
        cutout.setAttribute('y', y);
        cutout.setAttribute('width', w);
        cutout.setAttribute('height', h);
        cutout.setAttribute('rx', r);
        cutout.setAttribute('ry', r);
      }

      if (progress < 1) {
        animFrameId = requestAnimationFrame(step);
      }
    }

    animFrameId = requestAnimationFrame(step);
  }

  const steps = [
    {
      title: "Welcome to Flash Dash",
      text: "A clean, distraction-free dashboard crafted for focus. Let's take a quick 1-minute tour of your whiteboard vision board, daily tasks, app shortcuts, and focus tools.",
      target: () => null,
      placement: "center",
      onBeforeShow: () => {
        closeAllDrawers();
      }
    },
    {
      title: "Vision Board & Left Tools",
      text: "Pin personal goal photos directly to your infinite whiteboard canvas. Recenter your canvas view anytime, lock the board to prevent accidental dragging, clear images, or switch between dark and light themes.",
      target: () => document.getElementById('verticalToolbar'),
      placement: "right",
      onBeforeShow: () => {
        closeAllDrawers();
      }
    },
    {
      title: "Clock & Daily Tasks",
      text: "Click the time anytime to toggle between 12-hour and 24-hour formats. Below it, your collapsible task card tracks daily goals with priority tags (Low, Med, High), checkmarks, and hold-to-reorder tasks.",
      target: () => {
        const card = document.getElementById('dockTasksCard');
        if (card) card.classList.remove('collapsed');
        return document.getElementById('topRightDock');
      },
      placement: "left",
      transitionDelay: 150,
      onBeforeShow: () => {
        closeAllDrawers();
      }
    },
    {
      title: "App Shortcuts Dock",
      text: "Your favorite web apps are always within reach at the bottom right. Click '+' to search and add links from your Chrome bookmarks, or press & hold any shortcut tile for 150ms to rearrange them.",
      target: () => document.getElementById('bottomRightDock'),
      placement: "left",
      onBeforeShow: () => {
        closeAllDrawers();
      }
    },
    {
      title: "Focus Mode & Timer",
      text: "Double-click the background or the clock anytime to enter distraction-free Focus Mode. Pick countdown presets (10m, 25m, 30m, 45m, 60m), track daily focus streaks, and use quick shortcuts ([Space], [R], [M]).",
      target: () => {
        document.body.classList.add('focus-mode');
        const timerView = document.getElementById('timerView');
        if (timerView) {
          timerView.style.opacity = '1';
          timerView.style.transform = 'scale(1)';
          timerView.style.pointerEvents = 'auto';
        }
        return timerView;
      },
      placement: "right",
      onBeforeShow: () => {
        closeAllDrawers();
      },
      onAfterHide: () => {
        document.body.classList.remove('focus-mode');
        const timerView = document.getElementById('timerView');
        if (timerView) {
          timerView.style.opacity = '';
          timerView.style.transform = '';
          timerView.style.pointerEvents = '';
        }
      }
    }
  ];

  function closeAllDrawers() {
    const popover = document.getElementById('shortcutPickerPopover');
    if (popover) popover.classList.remove('open');
  }

  function startTutorial() {
    currentStep = 0;
    document.body.classList.add('tutorial-active');
    overlay.classList.add('visible');
    showStep(currentStep);
  }

  function cleanActiveTarget() {
    if (activeTarget && activeTarget.classList) {
      activeTarget.style.position = activeTarget.dataset.origPosition || '';
      activeTarget.style.zIndex = activeTarget.dataset.origZIndex || '';
      activeTarget.style.pointerEvents = activeTarget.dataset.origPointerEvents || '';

      delete activeTarget.dataset.origPosition;
      delete activeTarget.dataset.origZIndex;
      delete activeTarget.dataset.origPointerEvents;

      activeTarget.classList.remove('tutorial-highlight-target');
    }
    activeTarget = null;
  }

  function endTutorial(triggerNote = true) {
    const step = steps[currentStep];
    if (step && typeof step.onAfterHide === 'function') {
      step.onAfterHide();
    }

    closeAllDrawers();

    overlay.classList.remove('visible');
    document.body.classList.remove('tutorial-active');

    cleanActiveTarget();

    if (window.store) {
      window.store.set('onboardingCompleted', true);
    }

    if (triggerNote) {
      setTimeout(showCreatorNote, 300);
    }
  }

  async function showCreatorNote() {
    const noteOverlay = document.getElementById('creatorNoteOverlay');
    const closeBtn = document.getElementById('closeCreatorNoteBtn');
    const replayBtn = document.getElementById('replayTutorialBtn');
    if (!noteOverlay) return;

    if (window.store) {
      const creatorNoteSeen = await window.store.get('creatorNoteSeen', false);
      if (creatorNoteSeen) return;
    }

    noteOverlay.classList.add('visible');

    const closeNote = async () => {
      noteOverlay.classList.remove('visible');
      if (window.store) {
        await window.store.set('creatorNoteSeen', true);
      }
    };

    if (closeBtn) {
      closeBtn.onclick = closeNote;
    }

    if (replayBtn) {
      replayBtn.onclick = () => {
        closeNote();
        setTimeout(startTutorial, 250);
      };
    }

    noteOverlay.onclick = (e) => {
      if (e.target === noteOverlay) {
        closeNote();
      }
    };
  }

  function renderProgressDots(index) {
    const progressContainer = document.getElementById('tutorialProgressDots');
    if (!progressContainer) return;
    progressContainer.innerHTML = '';
    steps.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'tutorial-dot';
      if (i === index) dot.classList.add('active');
      progressContainer.appendChild(dot);
    });
  }

  function showStep(index) {
    tooltip.classList.remove('visible');

    const prevStep = steps[currentStep];
    if (prevStep && typeof prevStep.onAfterHide === 'function') {
      prevStep.onAfterHide();
    }
    cleanActiveTarget();

    currentStep = index;
    const step = steps[currentStep];

    if (typeof step.onBeforeShow === 'function') {
      step.onBeforeShow();
    }

    stepIndicator.textContent = `Step ${currentStep + 1} of ${steps.length}`;
    titleEl.textContent = step.title;
    textEl.textContent = step.text;
    nextBtn.textContent = (currentStep === steps.length - 1) ? "Get Started" : "Next";

    renderProgressDots(currentStep);

    const targetObj = step.target();
    const stepDelay = step.transitionDelay || 50;

    setTimeout(() => {
      let rect = null;

      if (targetObj && targetObj instanceof HTMLElement) {
        activeTarget = targetObj;

        activeTarget.dataset.origPosition = activeTarget.style.position || '';
        activeTarget.dataset.origZIndex = activeTarget.style.zIndex || '';
        activeTarget.dataset.origPointerEvents = activeTarget.style.pointerEvents || '';

        const computedStyle = window.getComputedStyle(activeTarget);
        if (computedStyle.position === 'static') {
          activeTarget.style.position = 'relative';
        }

        activeTarget.style.zIndex = '110010';
        activeTarget.style.pointerEvents = 'auto';
        activeTarget.classList.add('tutorial-highlight-target');

        rect = activeTarget.getBoundingClientRect();
      }

      positionTooltip(rect, step.placement);
    }, stepDelay);
  }

  function positionTooltip(rect, placement) {
    tooltip.classList.remove('visible');

    const tWidth = 310;
    const tHeight = tooltip.offsetHeight || 180;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    let tLeft = 0;
    let tTop = 0;

    if (placement === 'center' || !rect) {
      tLeft = (screenW - tWidth) / 2;
      tTop = (screenH - tHeight) / 2;
      tooltip.style.left = `${tLeft}px`;
      tooltip.style.top = `${tTop}px`;
      arrowPath.setAttribute('d', '');
      tooltip.classList.add('visible');

      animateCutoutTo(screenW / 2, screenH / 2, 0, 0, 0);
      return;
    }

    const margin = 52;
    let arrowStart = { x: 0, y: 0 };
    let arrowEnd = { x: 0, y: 0 };
    let controlPoint = { x: 0, y: 0 };

    const pad = 8;
    const targetX = rect.left - pad;
    const targetY = rect.top - pad;
    const targetW = rect.width + (pad * 2);
    const targetH = rect.height + (pad * 2);

    let radius = 16;
    if (activeTarget && activeTarget.id === 'verticalToolbar') {
      radius = targetW / 2;
    }

    animateCutoutTo(targetX, targetY, targetW, targetH, radius);

    if (placement === 'right') {
      tLeft = targetX + targetW + margin;
      tTop = targetY + (targetH / 2) - (tHeight / 2);

      tLeft = Math.min(screenW - tWidth - 20, Math.max(20, tLeft));
      tTop = Math.min(screenH - tHeight - 20, Math.max(20, tTop));

      arrowStart.x = tLeft;
      arrowStart.y = tTop + (tHeight / 2);
      arrowEnd.x = targetX + targetW;
      arrowEnd.y = targetY + (targetH / 2);

      controlPoint.x = (arrowStart.x + arrowEnd.x) / 2;
      controlPoint.y = (arrowStart.y + arrowEnd.y) / 2 - 35;

    } else if (placement === 'left') {
      tLeft = targetX - tWidth - margin;
      tTop = targetY + (targetH / 2) - (tHeight / 2);

      tLeft = Math.min(screenW - tWidth - 20, Math.max(20, tLeft));
      tTop = Math.min(screenH - tHeight - 20, Math.max(20, tTop));

      arrowStart.x = tLeft + tWidth;
      arrowStart.y = tTop + (tHeight / 2);
      arrowEnd.x = targetX;
      arrowEnd.y = targetY + (targetH / 2);

      controlPoint.x = (arrowStart.x + arrowEnd.x) / 2;
      controlPoint.y = (arrowStart.y + arrowEnd.y) / 2 - 35;

    } else if (placement === 'top') {
      tLeft = targetX + (targetW / 2) - (tWidth / 2);
      tTop = targetY - tHeight - margin;

      tLeft = Math.min(screenW - tWidth - 20, Math.max(20, tLeft));
      tTop = Math.min(screenH - tHeight - 20, Math.max(20, tTop));

      arrowStart.x = tLeft + (tWidth / 2);
      arrowStart.y = tTop + tHeight;
      arrowEnd.x = targetX + (targetW / 2);
      arrowEnd.y = targetY;

      controlPoint.x = (arrowStart.x + arrowEnd.x) / 2 - 25;
      controlPoint.y = (arrowStart.y + arrowEnd.y) / 2;

    } else if (placement === 'bottom') {
      tLeft = targetX + (targetW / 2) - (tWidth / 2);
      tTop = targetY + targetH + margin;

      tLeft = Math.min(screenW - tWidth - 20, Math.max(20, tLeft));
      tTop = Math.min(screenH - tHeight - 20, Math.max(20, tTop));

      arrowStart.x = tLeft + (tWidth / 2);
      arrowStart.y = tTop;
      arrowEnd.x = targetX + (targetW / 2);
      arrowEnd.y = targetY + targetH;

      controlPoint.x = (arrowStart.x + arrowEnd.x) / 2 - 25;
      controlPoint.y = (arrowStart.y + arrowEnd.y) / 2;
    }

    tooltip.style.left = `${tLeft}px`;
    tooltip.style.top = `${tTop}px`;

    const arrowD = `M ${arrowStart.x} ${arrowStart.y} Q ${controlPoint.x} ${controlPoint.y} ${arrowEnd.x} ${arrowEnd.y}`;
    arrowPath.setAttribute('d', arrowD);

    arrowPath.style.animation = 'none';
    arrowPath.offsetHeight;
    arrowPath.style.animation = '';

    tooltip.classList.add('visible');
  }

  function handleResize() {
    if (!overlay.classList.contains('visible')) return;

    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const step = steps[currentStep];
      if (step) {
        let rect = null;
        if (activeTarget && activeTarget instanceof HTMLElement) {
          rect = activeTarget.getBoundingClientRect();
        }
        positionTooltip(rect, step.placement);
      }
    }, 100);
  }

  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentStep < steps.length - 1) {
      showStep(currentStep + 1);
    } else {
      endTutorial();
    }
  });

  skipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    endTutorial();
  });

  tooltip.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  overlay.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  window.addEventListener('resize', handleResize);

  function handleKeyDown(e) {
    const creatorNoteOverlay = document.getElementById('creatorNoteOverlay');
    if (creatorNoteOverlay && creatorNoteOverlay.classList.contains('visible')) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const closeBtn = document.getElementById('closeCreatorNoteBtn');
        if (closeBtn) closeBtn.click();
      }
      return;
    }

    if (!overlay.classList.contains('visible')) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      nextBtn.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      endTutorial();
    }
  }

  window.addEventListener('keydown', handleKeyDown);

  // Auto-launch on first visit
  async function initTutorial() {
    let completed = false;
    if (window.store) {
      completed = await window.store.get('onboardingCompleted', false);
    }
    if (!completed) {
      setTimeout(startTutorial, 600);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTutorial);
  } else {
    initTutorial();
  }

  // Make triggers global for debugging/testing/replaying
  window.startTutorial = startTutorial;
  window.endTutorial = endTutorial;
})();
