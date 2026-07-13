(function() {
  // ============ CONFIGURATION ============
  const TOTAL_IMAGES_PER_SESSION = 50;

  // ============ SESSION STATE ============
  // Every page reload = new session (no localStorage persistence)
  let sessionStartTime = Date.now();
  let currentImageIndex = 0;
  let annotations = [];
  let currentClass = 'car';
  let currentTool = 'bbox';
  let isDrawing = false;
  let startX, startY;
  let imageStartTime = Date.now();

  // Session tracking
  let completedCount = 0;
  let sessionScores = []; // Array of {precision, time, score}
  let excellentCount = 0;
  let goodCount = 0;
  let poorCount = 0;

  // Generate today's batch ID from date
  const today = new Date();
  const batchId = '' + today.getFullYear() + String(today.getMonth()+1).padStart(2,'0') + String(today.getDate()).padStart(2,'0');

  // Generate 50 unique image URLs based on today's date (deterministic)
  function generateDailyImages() {
    const images = [];
    const keywords = ['street','city','road','traffic','highway','intersection','avenue','downtown','crosswalk','pedestrian'];
    for (let i = 0; i < TOTAL_IMAGES_PER_SESSION; i++) {
      const seed = batchId + '_' + i;
      const keyword = keywords[i % keywords.length];
      images.push({
        id: i + 1,
        name: keyword + '_' + String(i+1).padStart(3,'0') + '.jpg',
        url: 'https://picsum.photos/seed/' + seed + '/900/600',
        type: 'Bounding Box'
      });
    }
    return images;
  }

  const imageData = generateDailyImages();

  const classColors = {
    car: '#3b82f6', truck: '#f59e0b', pedestrian: '#22c55e',
    cyclist: '#a855f7', traffic_light: '#ef4444'
  };
  const classNames = {
    car: 'Car', truck: 'Truck', pedestrian: 'Pedestrian',
    cyclist: 'Cyclist', traffic_light: 'Traffic Light'
  };

  // ============ DOM ELEMENTS ============
  const canvas = document.getElementById('annotationCanvas');
  const ctx = canvas.getContext('2d');
  const imageLoader = document.getElementById('imageLoader');

  // ============ CLOCK ============
  function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString('en-US', {hour12: false});
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ============ STATS UPDATE ============
  function updateStats() {
    document.getElementById('statCompleted').textContent = completedCount;

    if (sessionScores.length > 0) {
      const avgPrecision = sessionScores.reduce((a,b) => a + b.precision, 0) / sessionScores.length;
      document.getElementById('statAccuracy').textContent = avgPrecision.toFixed(1) + '%';
    } else {
      document.getElementById('statAccuracy').textContent = '--';
    }

    const hours = ((Date.now() - sessionStartTime) / 3600000).toFixed(1);
    document.getElementById('statTime').textContent = hours + 'h';

    const progress = Math.floor((completedCount / TOTAL_IMAGES_PER_SESSION) * 100);
    document.getElementById('projectProgress').style.width = progress + '%';
    document.getElementById('progressText').textContent = progress + '%';
  }

  // ============ IMAGE LOADING ============
  function loadImage(index) {
    currentImageIndex = index;
    annotations = [];
    imageStartTime = Date.now();
    updateAnnotationList();

    const data = imageData[index];
    document.getElementById('imageName').textContent = data.name;
    document.getElementById('imageNum').textContent = String(index + 1).padStart(3, '0');
    document.getElementById('imageCounter').textContent = (index + 1) + ' / ' + TOTAL_IMAGES_PER_SESSION;
    document.getElementById('canvasOverlay').style.display = 'flex';

    imageLoader.style.display = 'block';

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      imageLoader.style.display = 'none';

      const container = document.getElementById('canvasContainer');
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const imgRatio = img.width / img.height;
      const containerRatio = containerWidth / containerHeight;

      let canvasWidth, canvasHeight;
      if (imgRatio > containerRatio) {
        canvasWidth = Math.min(containerWidth, 900);
        canvasHeight = canvasWidth / imgRatio;
      } else {
        canvasHeight = Math.min(containerHeight, 600);
        canvasWidth = canvasHeight * imgRatio;
      }

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = canvasWidth + 'px';
      canvas.style.height = canvasHeight + 'px';

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      updateTaskQueue();
    };
    img.onerror = function() {
      imageLoader.style.display = 'none';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Image loading...', canvas.width/2, canvas.height/2);
    };
    img.src = data.url;
  }

  function updateTaskQueue() {
    const queueEl = document.getElementById('taskQueue');
    queueEl.innerHTML = '';
    imageData.forEach((img, idx) => {
      const status = idx < currentImageIndex ? 'done' : idx === currentImageIndex ? 'active' : 'pending';
      const div = document.createElement('div');
      div.className = 'flex items-center gap-3 p-2 rounded-lg text-sm cursor-pointer transition-colors ' + 
        (status === 'active' ? 'bg-blue-50 border border-blue-200' : status === 'done' ? 'opacity-60' : 'hover:bg-slate-50 border border-transparent');
      div.innerHTML = '<div class="w-2 h-2 rounded-full ' + 
        (status === 'active' ? 'bg-blue-500 animate-pulse' : status === 'done' ? 'bg-green-400' : 'bg-slate-300') + '"></div>' +
        '<div class="flex-1 min-w-0"><div class="font-medium text-slate-700 truncate">' + img.name + '</div>' +
        '<div class="text-xs text-slate-400">' + img.type + '</div></div>' +
        (status === 'active' ? '<span class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Active</span>' : 
         status === 'done' ? '<span class="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Done</span>' : '');
      div.addEventListener('click', () => {
        if (status !== 'done') loadImage(idx);
      });
      queueEl.appendChild(div);
    });
  }

  // ============ CANVAS ANNOTATION ============
  function redrawCanvas() {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageData[currentImageIndex].url;
    img.onload = function() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      annotations.forEach(a => drawAnnotation(a));
    };
  }

  canvas.addEventListener('mousedown', e => {
    if (currentTool !== 'bbox') return;
    const rect = canvas.getBoundingClientRect();
    isDrawing = true;
    startX = (e.clientX - rect.left) * (canvas.width / rect.width);
    startY = (e.clientY - rect.top) * (canvas.height / rect.height);
  });

  canvas.addEventListener('mousemove', e => {
    if (!isDrawing || currentTool !== 'bbox') return;
    const rect = canvas.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const currentY = (e.clientY - rect.top) * (canvas.height / rect.height);

    redrawCanvas();

    ctx.strokeStyle = classColors[currentClass];
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
    ctx.setLineDash([]);
    ctx.fillStyle = classColors[currentClass] + '40';
    ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
  });

  canvas.addEventListener('mouseup', e => {
    if (!isDrawing || currentTool !== 'bbox') return;
    isDrawing = false;
    const rect = canvas.getBoundingClientRect();
    const endX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const endY = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (Math.abs(endX - startX) > 10 && Math.abs(endY - startY) > 10) {
      const ann = {
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        w: Math.abs(endX - startX),
        h: Math.abs(endY - startY),
        class: currentClass,
        id: Date.now()
      };
      annotations.push(ann);
      updateAnnotationList();
      showToast('Added ' + classNames[currentClass] + ' bounding box');
      document.getElementById('canvasOverlay').style.display = 'none';
    }
    redrawCanvas();
  });

  function drawAnnotation(a) {
    ctx.strokeStyle = classColors[a.class];
    ctx.lineWidth = 2;
    ctx.strokeRect(a.x, a.y, a.w, a.h);
    ctx.fillStyle = classColors[a.class] + '30';
    ctx.fillRect(a.x, a.y, a.w, a.h);

    const labelWidth = ctx.measureText(classNames[a.class]).width + 12;
    ctx.fillStyle = classColors[a.class];
    ctx.fillRect(a.x, a.y - 20, labelWidth, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText(classNames[a.class], a.x + 6, a.y - 5);
  }

  function updateAnnotationList() {
    const list = document.getElementById('annotationList');
    if (annotations.length === 0) {
      list.innerHTML = '<div class="text-sm text-slate-400 italic">No annotations yet. Draw a box to begin.</div>';
      return;
    }
    list.innerHTML = annotations.map(a => 
      '<div class="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-slate-100 group animate-slide-in">' +
      '<div class="w-3 h-3 rounded" style="background:' + classColors[a.class] + '"></div>' +
      '<span class="flex-1 font-medium text-slate-700">' + classNames[a.class] + '</span>' +
      '<span class="text-xs text-slate-400 font-mono">' + Math.round(a.x) + ',' + Math.round(a.y) + '</span>' +
      '<button onclick="window.deleteAnnotation(' + a.id + ')" class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">' +
      '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>'
    ).join('');
  }

  window.deleteAnnotation = function(id) {
    annotations = annotations.filter(a => a.id !== id);
    redrawCanvas();
    updateAnnotationList();
  };

  // ============ TOOL & CLASS SWITCHING ============
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => {
        b.classList.remove('active', 'border-blue-500', 'bg-blue-50', 'text-blue-600');
        b.classList.add('border-slate-200', 'text-slate-500');
      });
      btn.classList.add('active', 'border-blue-500', 'bg-blue-50', 'text-blue-600');
      btn.classList.remove('border-slate-200', 'text-slate-500');
      currentTool = btn.dataset.tool;

      if (btn.dataset.tool === 'erase') {
        annotations = [];
        redrawCanvas();
        updateAnnotationList();
        showToast('All annotations cleared');
        document.querySelector('.tool-btn[data-tool="bbox"]').click();
      }
    });
  });

  document.querySelectorAll('.class-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.class-btn').forEach(b => {
        b.classList.remove('border-blue-500', 'bg-blue-50');
        b.classList.add('border-transparent');
      });
      btn.classList.add('border-blue-500', 'bg-blue-50');
      btn.classList.remove('border-transparent');
      currentClass = btn.dataset.class;
    });
  });

  // ============ NAVIGATION ============
  document.getElementById('nextBtn').addEventListener('click', () => {
    if (currentImageIndex < TOTAL_IMAGES_PER_SESSION - 1) loadImage(currentImageIndex + 1);
  });

  document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentImageIndex > 0) loadImage(currentImageIndex - 1);
  });

  document.getElementById('skipBtn').addEventListener('click', () => {
    showToast('Image skipped');
    if (currentImageIndex < TOTAL_IMAGES_PER_SESSION - 1) {
      loadImage(currentImageIndex + 1);
    } else {
      showFinalReport();
    }
  });

  // ============ HELP MODAL ============
  document.getElementById('helpBtn').addEventListener('click', () => {
    document.getElementById('helpModal').classList.remove('hidden');
    document.getElementById('helpModal').classList.add('flex');
  });

  document.getElementById('closeHelp').addEventListener('click', () => {
    document.getElementById('helpModal').classList.add('hidden');
    document.getElementById('helpModal').classList.remove('flex');
  });

  // ============ SUBMIT & REVIEW ============
  document.getElementById('submitBtn').addEventListener('click', () => {
    const timeSpent = Math.floor((Date.now() - imageStartTime) / 1000);
    const expectedObjects = Math.floor(2 + Math.random() * 4);

    // Calculate precision based on annotation quality
    let precision = 0;
    if (annotations.length > 0) {
      // Base precision on number of annotations vs expected
      const countRatio = Math.min(annotations.length / expectedObjects, 1);
      // Add some randomness for realism
      precision = Math.floor(60 + (countRatio * 30) + (Math.random() * 10));
      precision = Math.min(100, Math.max(0, precision));
    }

    // Calculate image score (0-100)
    const timeBonus = timeSpent < 60 ? 10 : timeSpent < 120 ? 5 : 0;
    const imageScore = Math.min(100, precision + timeBonus);

    // Store session data
    sessionScores.push({ precision: precision, time: timeSpent, score: imageScore });
    if (precision >= 90) excellentCount++;
    else if (precision >= 70) goodCount++;
    else poorCount++;

    completedCount++;
    updateStats();

    // Show review modal
    const modal = document.getElementById('reviewModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    document.getElementById('reviewObjects').textContent = annotations.length + ' / ' + expectedObjects;
    document.getElementById('reviewPrecision').textContent = precision + '%';
    document.getElementById('reviewPrecision').className = 'font-medium ' + (precision >= 90 ? 'text-green-600' : precision >= 70 ? 'text-amber-600' : 'text-red-600');
    document.getElementById('reviewTime').textContent = timeSpent + 's';
    document.getElementById('reviewScore').textContent = imageScore + '/100';

    if (precision >= 90) {
      document.getElementById('reviewIcon').className = 'w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center';
      document.getElementById('reviewIcon').innerHTML = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
      document.getElementById('reviewTitle').textContent = 'Excellent Work!';
      document.getElementById('reviewTitle').className = 'font-semibold text-lg text-green-700';
      document.getElementById('reviewSubtitle').textContent = 'Your annotations meet quality standards.';
    } else if (precision >= 70) {
      document.getElementById('reviewIcon').className = 'w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center';
      document.getElementById('reviewIcon').innerHTML = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
      document.getElementById('reviewTitle').textContent = 'Good Job';
      document.getElementById('reviewTitle').className = 'font-semibold text-lg text-amber-700';
      document.getElementById('reviewSubtitle').textContent = 'Decent work, but there is room for improvement.';
    } else {
      document.getElementById('reviewIcon').className = 'w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center';
      document.getElementById('reviewIcon').innerHTML = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
      document.getElementById('reviewTitle').textContent = 'Needs Improvement';
      document.getElementById('reviewTitle').className = 'font-semibold text-lg text-red-700';
      document.getElementById('reviewSubtitle').textContent = 'Please review the guidelines and try again.';
    }
  });

  document.getElementById('closeReview').addEventListener('click', () => {
    document.getElementById('reviewModal').classList.add('hidden');
    document.getElementById('reviewModal').classList.remove('flex');
  });

  document.getElementById('continueBtn').addEventListener('click', () => {
    document.getElementById('reviewModal').classList.add('hidden');
    document.getElementById('reviewModal').classList.remove('flex');

    if (completedCount >= TOTAL_IMAGES_PER_SESSION) {
      showFinalReport();
    } else if (currentImageIndex < TOTAL_IMAGES_PER_SESSION - 1) {
      loadImage(currentImageIndex + 1);
      showToast('Loading next image...');
    }
  });

  // ============ FINAL REPORT ============
  function showFinalReport() {
    const modal = document.getElementById('finalReportModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Calculate totals
    const totalPrecision = sessionScores.reduce((a,b) => a + b.precision, 0);
    const avgPrecision = sessionScores.length > 0 ? (totalPrecision / sessionScores.length).toFixed(1) : '0.0';
    const totalScore = sessionScores.reduce((a,b) => a + b.score, 0);
    const hours = ((Date.now() - sessionStartTime) / 3600000).toFixed(1);

    document.getElementById('finalAccuracy').textContent = avgPrecision + '%';
    document.getElementById('finalScore').textContent = totalScore.toLocaleString();
    document.getElementById('finalCompleted').textContent = completedCount;
    document.getElementById('finalTime').textContent = hours + 'h';
    document.getElementById('excellentCount').textContent = excellentCount;
    document.getElementById('goodCount').textContent = goodCount;
    document.getElementById('poorCount').textContent = poorCount;

    // Confetti effect
    for (let i = 0; i < 50; i++) {
      setTimeout(() => createConfetti(), i * 50);
    }
  }

  function createConfetti() {
    const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 4000);
  }

  // ============ RESTART SESSION ============
  document.getElementById('restartBtn').addEventListener('click', () => {
    // Reload page = fresh session (no localStorage)
    window.location.reload();
  });

  // ============ TOAST ============
  function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
  }

  // ============ INITIALIZE ============
  document.getElementById('batchId').textContent = batchId;
  document.getElementById('imageBatchId').textContent = batchId;
  document.getElementById('totalImagesDisplay').textContent = TOTAL_IMAGES_PER_SESSION;
  updateStats();
  loadImage(0);
})();
