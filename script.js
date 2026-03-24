let bank = []; 
let currentTest = []; 
let userAnswers = [];
let currentIndex = 0;
let timerInterval;
let timeRemaining = 900; 

// SHAXSIY XOTIRA TIZIMI (Multi-user)
let currentUser = null;
let globalStorage = JSON.parse(localStorage.getItem('chdpuUsersData')) || {}; 
let userStats = { learned: [], errors: [] }; 

window.onload = async () => {
    generateChapterButtons();
    await loadAllJSONs();
    
    // Tungi rejimni xotiradan o'qish
    if (localStorage.getItem('theme') === 'dark') {
        document.getElementById('main-body').classList.add('dark-mode');
    }
};

async function loadAllJSONs() {
    try {
        const files = ['musiqa_nazariyasi.json', 'cholgu_ijrochiligi.json', 'vokal_ijrochiligi.json', 'metodika_repertuar.json'];
        for (let file of files) {
            let res = await fetch(file);
            let data = await res.json();
            let subject = file.split('.')[0];
            data = data.map((q, idx) => ({ ...q, id: `${subject}_${idx}`, subject: subject }));
            bank = bank.concat(data);
        }
    } catch (e) {
        console.error("Serverda Live Server orqali oching.", e);
    }
}

// 1. Tizimga Kirish va Chiqish
function handleLogin() {
    let nameInput = document.getElementById('student-name').value.trim();
    if (nameInput.length < 3) return alert("Iltimos, Ism Familiyangizni to'liq kiriting!");
    
    currentUser = nameInput;
    if (!globalStorage[currentUser]) globalStorage[currentUser] = { learned: [], errors: [] };
    userStats = globalStorage[currentUser]; 
    
    document.getElementById('display-student-name').innerText = currentUser;
    updateDashboardStats();
    switchScreen('welcome-screen', 'dashboard-screen');
}

function switchScreen(from, to) {
    document.getElementById(from).classList.replace('active', 'hidden');
    document.getElementById(to).classList.replace('hidden', 'active');
    document.getElementById('global-nav').classList.remove('hidden');
    document.getElementById('main-footer').classList.remove('hidden');
}

function logout() {
    if (!document.getElementById('test-screen').classList.contains('hidden')) {
        if(!confirm("Haqiqatan ham chiqmoqchimisiz? Natija saqlanmaydi!")) return;
    }
    clearInterval(timerInterval);
    currentUser = null;
    document.getElementById('student-name').value = ''; 
    location.reload(); // Tizimni qayta yuklash noldan
}

function exitTest() {
    if(confirm("Testdan chiqmoqchimisiz?")) {
        clearInterval(timerInterval);
        document.getElementById('test-screen').classList.replace('active', 'hidden');
        document.getElementById('dashboard-screen').classList.replace('hidden', 'active');
        document.getElementById('exam-timer').classList.add('hidden');
        document.getElementById('exit-test-btn').classList.add('hidden');
        document.getElementById('question-box').classList.remove('gravity-fall');
        updateDashboardStats();
    }
}

// 2. Anti-Cheat & Tungi Rejim
document.addEventListener("visibilitychange", () => {
    if (document.hidden && !document.getElementById('test-screen').classList.contains('hidden')) {
        alert("⚠️ DIQQAT! Oynani almashtirish anti-cheat tizimi tomonidan qayd etildi!");
    }
});

function toggleTheme() {
    let body = document.getElementById('main-body');
    body.classList.toggle('dark-mode');
    localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
}

// 3. Test Mantiqi
function startTest(subject) {
    let pool = subject === 'mixed' ? bank : bank.filter(q => q.subject === subject);
    let available = pool.filter(q => !userStats.learned.includes(q.id));
    if (available.length < 20) available = pool; 
    let selected = shuffleArray(available).slice(0, 20);
    prepareTestSet(selected);
}

function toggleChapters() { document.getElementById('chapters-grid').classList.toggle('hidden'); }
function generateChapterButtons() {
    const grid = document.getElementById('chapters-grid');
    for (let i = 1; i <= 40; i++) {
        let btn = document.createElement('button'); btn.className = 'chapter-btn';
        btn.innerText = `${(i - 1) * 20 + 1}-${i * 20}`;
        btn.onclick = () => { let startIdx = (i - 1) * 20; prepareTestSet(bank.slice(startIdx, startIdx + 20)); };
        grid.appendChild(btn);
    }
}

function prepareTestSet(sourceQuestions) {
    currentTest = sourceQuestions.map(q => {
        let correctText = q.options[q.answer];
        let shuffledOptions = shuffleArray([...q.options]);
        return { ...q, options: shuffledOptions, answer: shuffledOptions.indexOf(correctText) };
    });
    initTestUI();
}

function initTestUI() {
    document.getElementById('dashboard-screen').classList.replace('active', 'hidden');
    document.getElementById('test-screen').classList.replace('hidden', 'active');
    document.getElementById('exam-timer').classList.remove('hidden');
    document.getElementById('exit-test-btn').classList.remove('hidden');
    userAnswers = new Array(20).fill(null);
    currentIndex = 0;
    timeRemaining = 900;
    clearInterval(timerInterval);
    startTimer();
    buildIndicatorMap();
    renderQuestion();
    window.scrollTo(0, 0);
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeRemaining--;
        let m = Math.floor(timeRemaining / 60), s = timeRemaining % 60;
        document.getElementById('exam-timer').innerText = `${m}:${s < 10 ? '0'+s : s}`;
        if (timeRemaining <= 0) { clearInterval(timerInterval); finishExam(true); }
    }, 1000);
}

// 4. Interfeys (Map & Question)
function buildIndicatorMap() {
    const map = document.getElementById('map'); map.innerHTML = '';
    for (let i = 0; i < 20; i++) {
        let dot = document.createElement('div'); dot.className = 'dot'; dot.id = `dot-${i}`; dot.innerText = i + 1;
        dot.onclick = () => { currentIndex = i; renderQuestion(); }; map.appendChild(dot);
    }
}

function renderQuestion() {
    const q = currentTest[currentIndex]; const box = document.getElementById('question-box');
    box.innerHTML = `
        <h2 style="font-size: 1.1rem; color: gray;">Savol ${currentIndex+1}/20</h2>
        <h2>${q.q}</h2>
        <div class="options-list">
            ${q.options.map((opt, i) => `<button class="option-btn ${getBtnClass(i)}" onclick="handleSelect(${i}, this)" ${userAnswers[currentIndex] ? 'disabled' : ''}>${opt}</button>`).join('')}
        </div>`;
    updateUIState();
}

function getBtnClass(i) {
    if (!userAnswers[currentIndex]) return '';
    if (userAnswers[currentIndex].selected === i) return userAnswers[currentIndex].isCorrect ? 'correct-ans' : 'wrong-ans';
    return '';
}

function handleSelect(optIdx, btn) {
    const isCorrect = optIdx === currentTest[currentIndex].answer;
    userAnswers[currentIndex] = { selected: optIdx, isCorrect: isCorrect };
    
    if (isCorrect) {
        btn.classList.add('correct-ans');
        if (!userStats.learned.includes(currentTest[currentIndex].id)) userStats.learned.push(currentTest[currentIndex].id);
        userStats.errors = userStats.errors.filter(id => id !== currentTest[currentIndex].id);
    } else {
        btn.classList.add('wrong-ans');
        if (!userStats.errors.includes(currentTest[currentIndex].id)) userStats.errors.push(currentTest[currentIndex].id);
    }

    // Saqlash
    globalStorage[currentUser] = userStats;
    localStorage.setItem('chdpuUsersData', JSON.stringify(globalStorage));
    document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
    updateUIState();
    
    setTimeout(() => { let next = userAnswers.findIndex(ans => ans === null); if (next !== -1) { currentIndex = next; renderQuestion(); } }, 600);
}

function move(step) { let next = currentIndex + step; if (next >= 0 && next < 20) { currentIndex = next; renderQuestion(); } }

function updateUIState() {
    let answered = userAnswers.filter(a => a !== null).length;
    document.getElementById('progress-bar').style.width = `${(answered / 20) * 100}%`;
    for (let i = 0; i < 20; i++) {
        let dot = document.getElementById(`dot-${i}`); dot.className = 'dot';
        if (i === currentIndex) dot.classList.add('active-dot');
        if (userAnswers[i]) dot.classList.add(userAnswers[i].isCorrect ? 'correct' : 'wrong');
    }
    document.getElementById('score-correct').innerText = userAnswers.filter(a => a?.isCorrect).length;
    document.getElementById('score-wrong').innerText = userAnswers.filter(a => a && !a.isCorrect).length;
    if (answered === 20) document.getElementById('finish-trigger').classList.remove('hidden');
    else document.getElementById('finish-trigger').classList.add('hidden');
}

// 5. Yakunlash (100% Shart va Animatsiya)
function finishExam() {
    clearInterval(timerInterval);
    let correct = userAnswers.filter(a => a?.isCorrect).length;
    if (correct < 20) {
        alert(`Natija: ${correct}/20. Xatolaringiz bor!\n100% bo'lmaguncha ushbu test random aralashib qayta beriladi.`);
        currentTest = shuffleArray(currentTest).map(q => {
            let correctText = q.options[q.answer];
            let shuffledOpts = shuffleArray([...q.options]);
            return { ...q, options: shuffledOpts, answer: shuffledOpts.indexOf(correctText) };
        });
        initTestUI(); 
    } else { triggerWin(); }
}

function triggerWin() {
    document.getElementById('question-box').classList.add('gravity-fall');
    var end = Date.now() + 3000;
    (function frame() {
        confetti({ particleCount: 7, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#10B981', '#F59E0B', '#3B82F6'] });
        confetti({ particleCount: 7, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#10B981', '#F59E0B', '#3B82F6'] });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
    setTimeout(() => { alert("🎉 MUKAMMAL! Siz barcha savollarga to'g'ri javob berdingiz."); logout(); }, 2500);
}

function updateDashboardStats() {
    document.getElementById('total-learned').innerText = userStats.learned.length;
    document.getElementById('total-errors').innerText = userStats.errors.length;
    document.getElementById('error-work-btn').disabled = userStats.errors.length === 0;
}

function shuffleArray(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
}


