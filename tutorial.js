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
      title: "Welcome to Flash Dash! ⚡",
      text: "This is a visual guide book to show you around your new dashboard and where all your tools are located.",
      target: () => null,
      placement: "center",
      onBeforeShow: () => {
        closeAllDrawers();
      }
    },
    {
      title: "Left Toolbar",
      text: "This main Toolbar houses all your widgets and settings. Access Bookmarks to search favorite links, manage Tasks, upload custom screen Backgrounds (dim/blur), or Toggle dark and light theme modes.",
      target: () => document.getElementById('verticalToolbar'),
      placement: "right",
      onBeforeShow: () => {
        closeAllDrawers();
      }
    },
    {
      title: "Clock & Date",
      text: "At the center is the Minimal Clock and calendar. It displays the current local time and date in a clean font designed to stay out of the way of your vision board elements.",
      target: () => document.getElementById('clockView'),
      placement: "right"
    },
    {
      title: "Focus Mode Timer",
      text: "Behind the clock is the Focus Timer. When active, it displays a countdown. You can configure duration presets here to start focused work sessions and build a daily focus streak.",
      target: () => {
        // Visually trigger Focus Mode preview
        document.body.classList.add('focus-mode');
        const timerView = document.getElementById('timerView');
        if (timerView) {
          timerView.style.opacity = '1';
          timerView.style.transform = 'scale(1)';
          timerView.style.pointerEvents = 'auto';
        }
        const clockView = document.getElementById('clockView');
        if (clockView) {
          clockView.style.opacity = '0';
          clockView.style.transform = 'scale(0.96)';
          clockView.style.pointerEvents = 'none';
        }
        return timerView;
      },
      placement: "right",
      onAfterHide: () => {
        document.body.classList.remove('focus-mode');
        const timerView = document.getElementById('timerView');
        if (timerView) {
          timerView.style.opacity = '';
          timerView.style.transform = '';
          timerView.style.pointerEvents = '';
        }
        const clockView = document.getElementById('clockView');
        if (clockView) {
          clockView.style.opacity = '';
          clockView.style.transform = '';
          clockView.style.pointerEvents = '';
        }
      }
    },
    {
      title: "Quick Shortcuts",
      text: "Below the clock is the Pinned Shortcuts grid. This is where your favorite websites are located for fast navigation. You can add new links, rearrange their order, or remove them.",
      target: () => document.getElementById('ghostGrid'),
      placement: "right"
    },
    {
      title: "Vision Board Canvas",
      text: "The entire background acts as a freeform Vision Board. This is where your pinned goal photos and GIFs reside. You can add goals using this upload button, or simply drag and drop images directly onto the screen.",
      target: () => document.getElementById('addPhotoBtn'),
      placement: "right"
    },
    {
      title: "Google Search Bar",
      text: "At the bottom is the Search Bar. It allows you to search Google directly from the new tab, offering autocomplete query suggestions, matching bookmarks, and top sites lookup.",
      target: () => document.getElementById('searchWrapper'),
      placement: "left"
    }
  ];

  function closeAllDrawers() {
    const drawers = ['bookmarksDrawer', 'bgSettingsDrawer', 'todoDrawer'];
    drawers.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('open');
    });
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

  function endTutorial() {
    // Run cleanup for current step
    const step = steps[currentStep];
    if (step && typeof step.onAfterHide === 'function') {
      step.onAfterHide();
    }

    // Hide overlay
    overlay.classList.remove('visible');
    document.body.classList.remove('tutorial-active');

    // Clean target element highlights
    cleanActiveTarget();

    // Persist completed state in storage
    if (window.store) {
      window.store.set('onboardingCompleted', true);
    }

    // Trigger the personal welcome note modal!
    setTimeout(showCreatorNote, 300);
  }

  function showCreatorNote() {
    const noteOverlay = document.getElementById('creatorNoteOverlay');
    const closeBtn = document.getElementById('closeCreatorNoteBtn');
    if (!noteOverlay) return;

    noteOverlay.classList.add('visible');

    const closeNote = () => {
      noteOverlay.classList.remove('visible');
    };

    if (closeBtn) {
      closeBtn.onclick = closeNote;
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
    // Fade out tooltip card first
    tooltip.classList.remove('visible');

    // Cleanup previous step's highlight and callback
    const prevStep = steps[currentStep];
    if (prevStep && typeof prevStep.onAfterHide === 'function') {
      prevStep.onAfterHide();
    }
    cleanActiveTarget();

    currentStep = index;
    const step = steps[currentStep];

    // Trigger step preview callback
    if (typeof step.onBeforeShow === 'function') {
      step.onBeforeShow();
    }

    // Update metadata content
    stepIndicator.textContent = `Step ${currentStep + 1} of ${steps.length}`;
    titleEl.textContent = step.title;
    textEl.textContent = step.text;
    nextBtn.textContent = (currentStep === steps.length - 1) ? "Get Started" : "Next";

    renderProgressDots(currentStep);

    // Call target() first to start any drawer animations
    const targetObj = step.target();
    const stepDelay = step.transitionDelay || 50;

    // Wait for drawer transition to complete before measuring and positioning
    setTimeout(() => {
      let rect = null;
      
      if (targetObj && targetObj instanceof HTMLElement) {
        activeTarget = targetObj;
        
        // Save original layout styles
        activeTarget.dataset.origPosition = activeTarget.style.position || '';
        activeTarget.dataset.origZIndex = activeTarget.style.zIndex || '';
        activeTarget.dataset.origPointerEvents = activeTarget.style.pointerEvents || '';
        
        // Make sure it has relative/absolute position so z-index layers correctly
        const computedStyle = window.getComputedStyle(activeTarget);
        if (computedStyle.position === 'static') {
          activeTarget.style.position = 'relative';
        }
        
        // Bring targeted component to front above frosted mask overlay
        activeTarget.style.zIndex = '110060';
        activeTarget.style.pointerEvents = 'none'; // non-interactive during tour
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
      arrowPath.setAttribute('d', ''); // Hide arrow
      tooltip.classList.add('visible');
      
      // Animate cutout smoothly back to center with 0 size
      animateCutoutTo(screenW / 2, screenH / 2, 0, 0, 0);
      return;
    }

    const margin = 52; // Distance between card and spotlighted element
    let arrowStart = { x: 0, y: 0 };
    let arrowEnd = { x: 0, y: 0 };
    let controlPoint = { x: 0, y: 0 };

    // Pad spotlight bounds
    const pad = 8;
    const targetX = rect.left - pad;
    const targetY = rect.top - pad;
    const targetW = rect.width + (pad * 2);
    const targetH = rect.height + (pad * 2);

    // Determine standard premium rounding or pill shape for verticalToolbar
    let radius = 16;
    if (activeTarget && activeTarget.id === 'verticalToolbar') {
      radius = targetW / 2;
    }

    // Smoothly animate the spotlight cutout using Javascript easing
    animateCutoutTo(targetX, targetY, targetW, targetH, radius);

    if (placement === 'right') {
      tLeft = targetX + targetW + margin;
      tTop = targetY + (targetH / 2) - (tHeight / 2);
      
      // Keep tooltip fully inside window viewport
      tLeft = Math.min(screenW - tWidth - 20, Math.max(20, tLeft));
      tTop = Math.min(screenH - tHeight - 20, Math.max(20, tTop));

      arrowStart.x = tLeft;
      arrowStart.y = tTop + (tHeight / 2);
      arrowEnd.x = targetX + targetW;
      arrowEnd.y = targetY + (targetH / 2);

      // Curved sketchy line control point
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

    // Draw sketchy curved arrow using quadratic bezier path
    const arrowD = `M ${arrowStart.x} ${arrowStart.y} Q ${controlPoint.x} ${controlPoint.y} ${arrowEnd.x} ${arrowEnd.y}`;
    arrowPath.setAttribute('d', arrowD);

    // Force arrow animation to replay
    arrowPath.style.animation = 'none';
    arrowPath.offsetHeight; /* trigger reflow */
    arrowPath.style.animation = '';

    // Fade tooltip card back in
    tooltip.classList.add('visible');
  }

  function handleResize() {
    if (!overlay.classList.contains('visible')) return;

    // Debounce window resizes to prevent janky animations
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
    }
  }

  window.addEventListener('keydown', handleKeyDown);

  // Auto start tutorial on clean launches
  (async function () {
    if (window.store) {
      const onboardingCompleted = await window.store.get('onboardingCompleted', false);
      if (!onboardingCompleted) {
        // Wait slightly for main UI logic to settle
        setTimeout(startTutorial, 400);
      }
    }
  })();

  // Make triggers global for debugging/testing
  window.startTutorial = startTutorial;
  window.endTutorial = endTutorial;
})();
