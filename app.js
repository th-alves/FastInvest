// ============================================================
// FastInvest — App Logic
// All data persisted in LocalStorage
// ============================================================

// ===================== CONSTANTS =====================
const KRAKEN_CATEGORIES = [
    { key: 'K1', letter: 'K', name: 'Caixa', idealMin: 10, idealMax: 15, color: '#A366FF', desc: 'Reserva de emergência e liquidez' },
    { key: 'R', letter: 'R', name: 'REITs / FIIs', idealMin: 25, idealMax: 25, color: '#E63946', desc: 'Fundos Imobiliários' },
    { key: 'A', letter: 'A', name: 'Ações BR', idealMin: 25, idealMax: 25, color: '#34D399', desc: 'Ações brasileiras' },
    { key: 'K2', letter: 'K', name: 'Criptomoedas', idealMin: 1, idealMax: 5, color: '#FFB703', desc: 'Ativos digitais' },
    { key: 'E', letter: 'E', name: 'Exterior / Stocks', idealMin: 25, idealMax: 25, color: '#FF6B7A', desc: 'Investimentos no exterior' },
    { key: 'N', letter: 'N', name: 'Negócios', idealMin: 10, idealMax: 15, color: '#F43F5E', desc: 'Negócios e empreendimentos' }
];

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_NAMES_SHORT = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

// Pie chart colors (for monthly proventos distribution)
const PIE_COLORS = [
    '#E63946', '#FFB703', '#A366FF', '#34D399', '#FF6B7A',
    '#F43F5E', '#FFC94D', '#B88AFF', '#2D9F6F', '#FF8A96',
    '#E09F00', '#D962A0', '#FF5C6B'
];

// ===================== STATE =====================
let currentProventosMonth = { year: new Date().getFullYear(), month: new Date().getMonth() };
let currentAporteMonth = { year: new Date().getFullYear(), month: new Date().getMonth() };
let currentBarMode = 'dividendos';
let currentProventosFilter = 'all';

// ===================== STORAGE HELPERS =====================
function loadData(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// ===================== FORMATTING =====================
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
    return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value) {
    if (value === null || value === undefined || isNaN(value)) return '0,00%';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

function parseCurrencyInput(str) {
    if (!str) return 0;
    let cleaned = str.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
}

function parsePercentInput(str) {
    if (!str) return 0;
    let cleaned = str.replace(/[%\s]/g, '').replace(',', '.');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
}

function handleCurrencyInput(input) {
    let raw = input.value.replace(/[^\d]/g, '');
    if (raw === '') { input.value = ''; return; }
    let num = parseInt(raw, 10) / 100;
    input.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function handlePercentInput(input) {
    let raw = input.value.replace(/[^\d,.-]/g, '');
    if (raw === '') { input.value = ''; return; }
    raw = raw.replace(',', '.');
    let num = parseFloat(raw);
    if (isNaN(num)) num = 0;
    input.value = num > 0 ? num.toString() : '';
}

function monthKey(year, month) {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function monthLabel(year, month) {
    return `${MONTH_NAMES[month]} ${year}`;
}

function monthLabelShort(year, month) {
    return `${MONTH_NAMES_SHORT[month]}/${year}`;
}

// ===================== NAVIGATION =====================
function enterDashboard() {
    const landing = document.getElementById('landing');
    const dashboard = document.getElementById('dashboard');

    landing.classList.add('hidden');
    // Wait for the transition to complete before showing dashboard
    setTimeout(() => {
        dashboard.classList.add('active');
        document.body.classList.add('dashboard-active');
        initDashboardParticles();
        initDashboard();
    }, 350);
}

function goToLanding() {
    const dashboard = document.getElementById('dashboard');
    const landing = document.getElementById('landing');

    dashboard.classList.remove('active');
    document.body.classList.remove('dashboard-active');

    // Small delay to let dashboard fade out
    setTimeout(() => {
        landing.classList.remove('hidden');
    }, 100);
}

function switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const target = document.getElementById(`tab-${tabName}`);
    if (target) {
        target.classList.add('active');
    }
    // Move indicator
    updateTabIndicator();

    // Refresh data
    if (tabName === 'kraken') renderKraken();
    if (tabName === 'proventos') renderProventos();
    if (tabName === 'aporte') renderAporte();
}

function updateTabIndicator() {
    const activeBtn = document.querySelector('.tab-btn.active');
    const indicator = document.getElementById('tabIndicator');
    if (activeBtn && indicator) {
        indicator.style.width = activeBtn.offsetWidth + 'px';
        indicator.style.left = activeBtn.offsetLeft + 'px';
    }
}

// ===================== TOAST =====================
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    toastMsg.textContent = msg;
    toast.className = 'toast show ' + type;
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => { toast.className = 'toast'; }, 3000);
}

// ===================== PARTICLES =====================
function initParticles() {
    const container = document.getElementById('particles');
    if (!container) return;

    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = (40 + Math.random() * 60) + '%';
        particle.style.animationDelay = (Math.random() * 6) + 's';
        particle.style.animationDuration = (3 + Math.random() * 4) + 's';
        particle.style.opacity = 0;
        container.appendChild(particle);
    }
}

function initDashboardParticles() {
    const container = document.getElementById('dashboardParticles');
    if (!container || container.children.length > 0) return; // avoid re-spawn

    for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.className = 'd-particle';

        // Bias particles to left and right edges (outside card area)
        const side = i < 10 ? Math.random() * 16 : 84 + Math.random() * 16;
        p.style.left = side + '%';

        p.style.bottom = -(Math.random() * 20) + '%';
        p.style.animationDelay = (Math.random() * 8) + 's';
        p.style.animationDuration = (5 + Math.random() * 6) + 's';

        const size = 1.5 + Math.random() * 2;
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.opacity = 0;

        container.appendChild(p);
    }
}

// ===================== INIT =====================
function initDashboard() {
    renderKraken();
    renderProventos();
    renderAporte();
    setTimeout(updateTabIndicator, 50);
}

// ============================================================
// TAB 1: KRAKEN
// ============================================================

function getKrakenData() {
    return loadData('byfinance_kraken', {
        dividendGoal: 0,
        patrimonioTotal: 0,
        categories: {}
    });
}

function saveKrakenData() {
    const data = getKrakenData();
    data.dividendGoal = parseCurrencyInput(document.getElementById('dividendGoal').value);
    data.patrimonioTotal = parseCurrencyInput(document.getElementById('patrimonioTotal').value);

    KRAKEN_CATEGORIES.forEach(cat => {
        const applied = document.getElementById(`kraken_applied_${cat.key}`);
        const ideal = document.getElementById(`kraken_ideal_${cat.key}`);
        const atual = document.getElementById(`kraken_atual_${cat.key}`);
        const assets = document.getElementById(`kraken_assets_${cat.key}`);
        if (applied && ideal && atual) {
            data.categories[cat.key] = {
                applied: parseCurrencyInput(applied.value),
                ideal: parsePercentInput(ideal.value),
                atual: parsePercentInput(atual.value),
                assets: assets ? assets.value : ''
            };
        }
    });

    saveData('byfinance_kraken', data);
    updateKrakenCalculations();
}

function renderKraken() {
    const data = getKrakenData();
    const grid = document.getElementById('krakenGrid');

    // Set dividend goal
    const goalInput = document.getElementById('dividendGoal');
    if (data.dividendGoal > 0) {
        goalInput.value = data.dividendGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
        goalInput.value = '';
    }

    // Set patrimonio total
    const patrimonioInput = document.getElementById('patrimonioTotal');
    if (data.patrimonioTotal > 0) {
        patrimonioInput.value = data.patrimonioTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
        patrimonioInput.value = '';
    }

    // Render category cards
    grid.innerHTML = KRAKEN_CATEGORIES.map(cat => {
        const catData = data.categories[cat.key] || { applied: 0, ideal: 0, atual: 0, assets: '' };
        return `
        <div class="category-card" style="--cat-color: ${cat.color}">
            <div class="category-header">
                <div class="kraken-letter-wrap" style="background: ${cat.color}18; color: ${cat.color}">
                    <span class="kraken-letter">${cat.letter}</span>
                </div>
                <div class="category-title-wrap">
                    <h4 class="category-name">${cat.name}</h4>
                    <span class="category-desc">${cat.desc}</span>
                </div>
            </div>
            <div class="category-body">
                <div class="category-inputs">
                    <div class="input-group">
                        <label>Valor Aplicado</label>
                        <div class="input-with-prefix">
                            <span class="currency-prefix">R$</span>
                            <input type="text" id="kraken_applied_${cat.key}" class="input-field" placeholder="0,00"
                                value="${catData.applied > 0 ? catData.applied.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}"
                                oninput="handleCurrencyInput(this); saveKrakenData()">
                        </div>
                    </div>
                    <div class="input-group">
                        <label>Ideal %</label>
                        <div class="input-with-suffix">
                            <input type="text" id="kraken_ideal_${cat.key}" class="input-field" placeholder="0"
                                value="${catData.ideal > 0 ? catData.ideal : ''}"
                                oninput="handlePercentInput(this); saveKrakenData()">
                            <span class="currency-suffix">%</span>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>% Atual</label>
                        <div class="input-with-suffix">
                            <input type="text" id="kraken_atual_${cat.key}" class="input-field" placeholder="0"
                                value="${catData.atual > 0 ? catData.atual : ''}"
                                oninput="handlePercentInput(this); saveKrakenData()">
                            <span class="currency-suffix">%</span>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>Quanto Investir</label>
                        <div class="input-with-prefix">
                            <span class="currency-prefix">R$</span>
                            <input type="text" id="kraken_invest_${cat.key}" class="input-field" placeholder="0,00" disabled
                                value="R$ 0,00">
                        </div>
                    </div>
                </div>
                <div class="input-group assets-group">
                    <label>📋 Ativos</label>
                    <textarea id="kraken_assets_${cat.key}" class="textarea-field" placeholder="Ex: HCTR11, MXRF11, RECR11..." rows="2"
                        oninput="saveKrakenData()">${catData.assets || ''}</textarea>
                </div>
            </div>
        </div>`;
    }).join('');

    updateKrakenCalculations();
}

function updateKrakenCalculations() {
    const data = getKrakenData();
    const patrimonioTotal = data.patrimonioTotal || 0;

    // Update each category
    KRAKEN_CATEGORIES.forEach(cat => {
        const cd = data.categories[cat.key] || { applied: 0, ideal: 0, atual: 0 };
        
        // Calculate how much to invest based on patrimonio total and ideal %
        const quantoInvestir = patrimonioTotal > 0 ? (patrimonioTotal * (cd.ideal / 100)) : 0;
        
        // Update fields
        const investEl = document.getElementById(`kraken_invest_${cat.key}`);
        if (investEl) investEl.value = formatCurrency(quantoInvestir);
    });
}

// ============================================================
// TAB 2: PROVENTOS
// ============================================================

function getProventosData() {
    return loadData('byfinance_proventos', {});
}

function changeProventosMonth(delta) {
    currentProventosMonth.month += delta;
    if (currentProventosMonth.month > 11) { currentProventosMonth.month = 0; currentProventosMonth.year++; }
    if (currentProventosMonth.month < 0) { currentProventosMonth.month = 11; currentProventosMonth.year--; }
    renderProventos();
}

function renderProventos() {
    const data = getProventosData();
    const key = monthKey(currentProventosMonth.year, currentProventosMonth.month);
    const monthData = data[key] || {};

    // Update month label
    document.getElementById('proventosCurrentMonth').textContent = monthLabel(currentProventosMonth.year, currentProventosMonth.month);

    // Fill form
    setInputValue('provValorAplicado', monthData.valorAplicado);
    setInputValue('provSaldoBruto', monthData.saldoBruto);
    setInputValue('provDividendos', monthData.dividendos);
    setInputValue('provDividendosFII', monthData.dividendosFII);
    setInputValue('provValorFII', monthData.valorFII);

    // Show calc card if data exists
    const calcCard = document.getElementById('proventosCalcCard');
    if (monthData.valorAplicado || monthData.saldoBruto) {
        calcCard.style.display = '';
        document.getElementById('calcMonthBadge').textContent = monthLabelShort(currentProventosMonth.year, currentProventosMonth.month);
        updateProventosCalc(monthData, key, data);
    } else {
        calcCard.style.display = 'none';
    }

    // Summary stats
    updateProventosSummary(data);

    // Table
    renderProventosTable(data);

    // Bar chart
    renderBarChart(data, currentBarMode);

    // Filters
    renderProventosFilters(data);

    // Chart
    renderProventosPieChart(data);
}

function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.value = value && value > 0 ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    }
}

function saveProventosMonth() {
    const data = getProventosData();
    const key = monthKey(currentProventosMonth.year, currentProventosMonth.month);

    data[key] = {
        year: currentProventosMonth.year,
        month: currentProventosMonth.month,
        valorAplicado: parseCurrencyInput(document.getElementById('provValorAplicado').value),
        saldoBruto: parseCurrencyInput(document.getElementById('provSaldoBruto').value),
        dividendos: parseCurrencyInput(document.getElementById('provDividendos').value),
        dividendosFII: parseCurrencyInput(document.getElementById('provDividendosFII').value),
        valorFII: parseCurrencyInput(document.getElementById('provValorFII').value)
    };

    saveData('byfinance_proventos', data);
    renderProventos();
    renderAporte();
    updateKrakenCalculations();
    showToast('Proventos salvos com sucesso!');
}

function updateProventosCalc(monthData, key, allData) {
    const va = monthData.valorAplicado || 0;
    const sb = monthData.saldoBruto || 0;
    const divFII = monthData.dividendosFII || 0;
    const valFII = monthData.valorFII || 0;

    const ganhoCapR = sb - va;
    const ganhoCapPct = va > 0 ? (ganhoCapR / va) * 100 : 0;
    const yieldFII = valFII > 0 ? (divFII / valFII) * 100 : 0;

    // Performance: need previous month total proventos
    const sortedKeys = Object.keys(allData).sort();
    const currentIdx = sortedKeys.indexOf(key);
    let performance = null;
    if (currentIdx > 0) {
        let totalProvPrev = 0;
        for (let i = 0; i <= currentIdx - 1; i++) {
            totalProvPrev += (allData[sortedKeys[i]]?.dividendos || 0);
        }
        if (ganhoCapR !== 0) {
            performance = (ganhoCapR - (sb - totalProvPrev)) / ganhoCapR * 100;
        }
    }

    document.getElementById('calcGanhoCapital').textContent = formatCurrency(ganhoCapR);
    document.getElementById('calcGanhoCapitalPct').textContent = formatPercent(ganhoCapPct);
    document.getElementById('calcYieldFII').textContent = formatPercent(yieldFII);
    document.getElementById('calcPerformance').textContent = performance !== null ? formatPercent(performance) : '—';
}

function updateProventosSummary(data) {
    const keys = Object.keys(data).sort();
    let totalProventos = 0;
    let lastGanhoCapR = 0;
    let lastGanhoCapPct = 0;
    let lastYield = 0;
    let lastPerformance = 0;

    keys.forEach(k => {
        totalProventos += (data[k].dividendos || 0);
    });

    if (keys.length > 0) {
        const last = data[keys[keys.length - 1]];
        const va = last.valorAplicado || 0;
        const sb = last.saldoBruto || 0;
        lastGanhoCapR = sb - va;
        lastGanhoCapPct = va > 0 ? (lastGanhoCapR / va) * 100 : 0;
        lastYield = (last.valorFII || 0) > 0 ? ((last.dividendosFII || 0) / (last.valorFII || 1)) * 100 : 0;

        if (keys.length > 1) {
            let totalProvPrev = 0;
            for (let i = 0; i < keys.length - 1; i++) {
                totalProvPrev += (data[keys[i]]?.dividendos || 0);
            }
            if (lastGanhoCapR !== 0) {
                lastPerformance = (lastGanhoCapR - (sb - totalProvPrev)) / lastGanhoCapR * 100;
            }
        }
    }

    document.getElementById('totalProventos').textContent = formatCurrency(totalProventos);
    document.getElementById('proventosCapitalGain').textContent = formatCurrency(lastGanhoCapR);
    document.getElementById('proventosCapitalGainPct').textContent = formatPercent(lastGanhoCapPct);
    document.getElementById('lastYieldFII').textContent = formatPercent(lastYield);
    document.getElementById('lastPerformance').textContent = formatPercent(lastPerformance);
}

function renderProventosTable(data) {
    let keys = Object.keys(data).sort();

    // Apply active filter
    const now = new Date();
    if (currentProventosFilter !== 'all') {
        if (currentProventosFilter === '6m') {
            const cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1);
            keys = keys.filter(k => {
                const d = data[k];
                return new Date(d.year, d.month, 1) >= cutoff;
            });
        } else if (currentProventosFilter === '12m') {
            const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);
            keys = keys.filter(k => {
                const d = data[k];
                return new Date(d.year, d.month, 1) >= cutoff;
            });
        } else {
            // year filter e.g. "2025"
            keys = keys.filter(k => String(data[k].year) === currentProventosFilter);
        }
    }

    const tbody = document.getElementById('proventosTableBody');
    const emptyState = document.getElementById('proventosEmpty');

    if (keys.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = '';
        return;
    }
    emptyState.style.display = 'none';

    tbody.innerHTML = keys.map((k, idx) => {
        const d = data[k];
        const va = d.valorAplicado || 0;
        const sb = d.saldoBruto || 0;
        const div = d.dividendos || 0;
        const divFII = d.dividendosFII || 0;
        const valFII = d.valorFII || 0;

        const ganhoR = sb - va;
        const ganhoPct = va > 0 ? (ganhoR / va) * 100 : 0;
        const yieldFII = valFII > 0 ? (divFII / valFII) * 100 : 0;

        // Growth rate
        let deltaR = '—';
        let deltaPct = '—';
        if (idx > 0) {
            const prevDiv = data[keys[idx - 1]]?.dividendos || 0;
            const dr = div - prevDiv;
            deltaR = formatCurrency(dr);
            deltaPct = prevDiv > 0 ? formatPercent((dr / prevDiv) * 100) : '—';
        }

        return `<tr>
            <td><span class="month-cell">${monthLabelShort(d.year, d.month)}</span></td>
            <td>${formatCurrency(va)}</td>
            <td>${formatCurrency(sb)}</td>
            <td>${formatCurrency(div)}</td>
            <td>${formatCurrency(divFII)}</td>
            <td class="${ganhoR >= 0 ? 'positive' : 'negative'}">${formatCurrency(ganhoR)}</td>
            <td class="${ganhoPct >= 0 ? 'positive' : 'negative'}">${formatPercent(ganhoPct)}</td>
            <td>${formatPercent(yieldFII)}</td>
            <td>${deltaR}</td>
            <td>${deltaPct}</td>
            <td>
                <button class="btn-icon btn-edit" onclick="editProventosMonth(${d.year}, ${d.month})" title="Editar">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 10.5V12H3.5L10.2 5.3L8.7 3.8L2 10.5ZM11.8 3.7C12 3.5 12 3.2 11.8 3L11 2.2C10.8 2 10.5 2 10.3 2.2L9.5 3L11 4.5L11.8 3.7Z" fill="currentColor"/></svg>
                </button>
                <button class="btn-icon btn-delete" onclick="deleteProventosMonth('${k}')" title="Excluir">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4H11L10.3 12H3.7L3 4ZM5 2H9M2 4H12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                </button>
            </td>
        </tr>`;
    }).join('');
}

function editProventosMonth(year, month) {
    currentProventosMonth = { year, month };
    renderProventos();
    document.querySelector('.proventos-input-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteProventosMonth(key) {
    if (!confirm('Deseja realmente excluir os dados deste mês?')) return;
    const data = getProventosData();
    delete data[key];
    saveData('byfinance_proventos', data);
    renderProventos();
    renderAporte();
    showToast('Dados do mês removidos', 'info');
}

// ===================== PIE CHART (Canvas) =====================
function renderProventosPieChart(data) {
    const canvas = document.getElementById('proventosChart');
    const emptyChart = document.getElementById('chartEmpty');
    const legendEl = document.getElementById('chartLegend');
    const ctx = canvas.getContext('2d');
    const keys = Object.keys(data).sort();

    if (keys.length === 0) {
        emptyChart.style.display = 'flex';
        canvas.style.display = 'none';
        legendEl.style.display = 'none';
        return;
    }

    // Filter months with actual dividendos > 0
    const validKeys = keys.filter(k => (data[k].dividendos || 0) > 0);

    if (validKeys.length === 0) {
        emptyChart.style.display = 'flex';
        canvas.style.display = 'none';
        legendEl.style.display = 'none';
        return;
    }

    emptyChart.style.display = 'none';
    canvas.style.display = '';
    legendEl.style.display = '';

    const values = validKeys.map(k => data[k].dividendos || 0);
    const labels = validKeys.map(k => {
        const d = data[k];
        return monthLabelShort(d.year, d.month);
    });
    const total = values.reduce((a, b) => a + b, 0);

    // Canvas sizing — garante size mínimo mesmo se o container não estiver visível
    const dpr = window.devicePixelRatio || 1;
    const parentWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 0;
    const size = Math.max(200, Math.min(380, parentWidth - 40));
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 20;
    const innerRadius = radius * 0.55; // Donut style

    ctx.clearRect(0, 0, size, size);

    let startAngle = -Math.PI / 2;

    values.forEach((val, i) => {
        const sliceAngle = (val / total) * Math.PI * 2;
        const endAngle = startAngle + sliceAngle;
        const color = PIE_COLORS[i % PIE_COLORS.length];

        // Draw slice
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(startAngle) * innerRadius, cy + Math.sin(startAngle) * innerRadius);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // Subtle border between slices
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-base').trim() || '#0A0A0A';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label if slice is big enough
        if (sliceAngle > 0.25) {
            const midAngle = startAngle + sliceAngle / 2;
            const labelR = (radius + innerRadius) / 2;
            const lx = cx + Math.cos(midAngle) * labelR;
            const ly = cy + Math.sin(midAngle) * labelR;
            const pct = ((val / total) * 100).toFixed(1) + '%';

            ctx.fillStyle = '#FFFFFF';
            ctx.font = `600 ${Math.max(11, size * 0.032)}px Inter`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pct, lx, ly);
        }

        startAngle = endAngle;
    });

    // Center text (total)
    const textMuted = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6B6058';
    const textPrimary = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#F0EBE3';
    ctx.fillStyle = textMuted;
    ctx.font = `500 ${Math.max(11, size * 0.035)}px Inter`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Total', cx, cy - 12);

    ctx.fillStyle = textPrimary;
    ctx.font = `700 ${Math.max(14, size * 0.05)}px Inter`;
    ctx.fillText(formatCurrency(total), cx, cy + 12);

    // Render legend
    legendEl.innerHTML = labels.map((label, i) => {
        const color = PIE_COLORS[i % PIE_COLORS.length];
        const val = values[i];
        return `<div class="chart-legend-item">
            <span class="chart-legend-dot" style="background: ${color}"></span>
            <span>${label}: ${formatCurrency(val)}</span>
        </div>`;
    }).join('');
}

// ============================================================
// BAR CHART — Histórico Mensal
// ============================================================

function setBarMode(mode) {
    currentBarMode = mode;
    const labels = { dividendos: 'Dividendos', dividendosFII: 'Div. FIIs', yieldFII: 'Yield FII' };
    document.querySelectorAll('.bar-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === labels[mode]);
    });
    renderBarChart(getProventosData(), mode);
}

function renderBarChart(data, mode) {
    const canvas = document.getElementById('barChart');
    const emptyEl = document.getElementById('barChartEmpty');
    if (!canvas) return;

    const keys = Object.keys(data).sort();
    const validKeys = keys.filter(k => {
        const d = data[k];
        if (mode === 'dividendos') return (d.dividendos || 0) > 0;
        if (mode === 'dividendosFII') return (d.dividendosFII || 0) > 0;
        return (d.valorFII || 0) > 0;
    });

    if (validKeys.length === 0) {
        emptyEl.style.display = 'flex';
        canvas.style.display = 'none';
        return;
    }
    emptyEl.style.display = 'none';
    canvas.style.display = '';

    const values = validKeys.map(k => {
        const d = data[k];
        if (mode === 'dividendos') return d.dividendos || 0;
        if (mode === 'dividendosFII') return d.dividendosFII || 0;
        return (d.valorFII || 0) > 0 ? ((d.dividendosFII || 0) / d.valorFII) * 100 : 0;
    });
    const labels = validKeys.map(k => {
        const d = data[k];
        return monthLabelShort(d.year, d.month);
    });

    const dpr = window.devicePixelRatio || 1;
    const wrapEl = document.getElementById('barChartWrap');
    const containerW = wrapEl ? wrapEl.clientWidth : 600;
    const minColW = 52; // minimum px per column — prevents cramping on mobile
    const minW = validKeys.length * minColW;
    const W = Math.max(minW, containerW);
    const H = 180;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const styles = getComputedStyle(document.documentElement);
    const primary   = styles.getPropertyValue('--primary').trim() || '#E63946';
    const textMuted = styles.getPropertyValue('--text-muted').trim() || '#6B6058';
    const borderCol = styles.getPropertyValue('--border-subtle').trim() || '#2A2522';

    const padL = 8, padR = 8, padTop = 28, padBot = 36;
    const chartW = W - padL - padR;
    const chartH = H - padTop - padBot;
    const maxVal = Math.max(...values, 0.001);
    const barW = Math.max(8, Math.min(40, (chartW / validKeys.length) * 0.6));
    const gap = chartW / validKeys.length;

    // Baseline
    ctx.beginPath();
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 1;
    ctx.moveTo(padL, padTop + chartH);
    ctx.lineTo(W - padR, padTop + chartH);
    ctx.stroke();

    values.forEach((val, i) => {
        const barH = Math.max(2, (val / maxVal) * chartH);
        const x = padL + gap * i + (gap - barW) / 2;
        const y = padTop + chartH - barH;

        ctx.fillStyle = primary;
        ctx.globalAlpha = 0.75;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
            ctx.fill();
        } else {
            ctx.fillRect(x, y, barW, barH);
        }
        ctx.globalAlpha = 1;

        // Always show value label above the bar
        const valStr = (mode === 'dividendos' || mode === 'dividendosFII')
            ? 'R$' + val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : val.toFixed(2) + '%';
        ctx.fillStyle = primary;
        ctx.font = '500 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(valStr, padL + gap * i + gap / 2, y - 5);

        ctx.fillStyle = textMuted;
        ctx.font = '400 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labels[i], padL + gap * i + gap / 2, padTop + chartH + 14);
    });
}

// ============================================================
// FILTROS — Histórico de Proventos
// ============================================================

function setProventosFilter(filter) {
    currentProventosFilter = filter;
    renderProventos();
}

function renderProventosFilters(data) {
    const container = document.getElementById('proventosFilters');
    if (!container) return;

    const keys = Object.keys(data).sort();
    const years = [...new Set(keys.map(k => String(data[k].year)))].sort();

    const filters = [
        { id: 'all', label: 'Todos' },
        { id: '6m',  label: 'Últimos 6 meses' },
        { id: '12m', label: 'Últimos 12 meses' },
        ...years.map(y => ({ id: y, label: y }))
    ];

    container.innerHTML = filters.map(f =>
        `<button class="filter-chip${currentProventosFilter === f.id ? ' active' : ''}"
            onclick="setProventosFilter('${f.id}')">${f.label}</button>`
    ).join('');
}

// ============================================================
// TAB 3: APORTE DO MÊS
// ============================================================

function getAporteData() {
    return loadData('byfinance_aportes', {});
}

function changeAporteMonth(delta) {
    currentAporteMonth.month += delta;
    if (currentAporteMonth.month > 11) { currentAporteMonth.month = 0; currentAporteMonth.year++; }
    if (currentAporteMonth.month < 0) { currentAporteMonth.month = 11; currentAporteMonth.year--; }
    renderAporte();
}

function renderAporte() {
    const aporteData = getAporteData();
    const proventosData = getProventosData();
    const key = monthKey(currentAporteMonth.year, currentAporteMonth.month);
    const monthData = aporteData[key] || {};

    document.getElementById('aporteCurrentMonth').textContent = monthLabel(currentAporteMonth.year, currentAporteMonth.month);

    // Fill form
    const aporteInput = document.getElementById('aporteValor');
    if (monthData.valor && monthData.valor > 0) {
        aporteInput.value = monthData.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
        aporteInput.value = '';
    }

    // Calculate suggested for NEXT month based on CURRENT month selector
    let prevM = currentAporteMonth.month - 1;
    let prevY = currentAporteMonth.year;
    if (prevM < 0) { prevM = 11; prevY--; }
    const prevKey = monthKey(prevY, prevM);
    const prevAporte = aporteData[prevKey]?.valor || 0;
    const prevDiv = proventosData[prevKey]?.dividendos || 0;
    const suggested = prevAporte + prevDiv;

    document.getElementById('suggestedAporteValue').textContent = formatCurrency(suggested);

    if (prevAporte > 0 || prevDiv > 0) {
        document.getElementById('suggestedFormula').textContent =
            `${formatCurrency(prevAporte)} (aporte) + ${formatCurrency(prevDiv)} (dividendos) = ${formatCurrency(suggested)}`;
    } else {
        document.getElementById('suggestedFormula').textContent = 'Aporte anterior + Dividendos do mês anterior';
    }

    // Table
    renderAporteTable(aporteData, proventosData);
}

function saveAporteMonth() {
    const data = getAporteData();
    const key = monthKey(currentAporteMonth.year, currentAporteMonth.month);

    data[key] = {
        year: currentAporteMonth.year,
        month: currentAporteMonth.month,
        valor: parseCurrencyInput(document.getElementById('aporteValor').value)
    };

    saveData('byfinance_aportes', data);
    renderAporte();
    updateKrakenCalculations();
    showToast('Aporte salvo com sucesso!');
}

function renderAporteTable(aporteData, proventosData) {
    const keys = Object.keys(aporteData).sort();
    const tbody = document.getElementById('aporteTableBody');
    const emptyState = document.getElementById('aporteEmpty');

    if (keys.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = '';
        return;
    }
    emptyState.style.display = 'none';

    tbody.innerHTML = keys.map((k, idx) => {
        const d = aporteData[k];
        const div = proventosData[k]?.dividendos || 0;

        // Suggested for this month: prev aporte + prev div
        let suggestedForMonth = 0;
        if (idx > 0) {
            const prevKey = keys[idx - 1];
            suggestedForMonth = (aporteData[prevKey]?.valor || 0) + (proventosData[prevKey]?.dividendos || 0);
        }

        return `<tr>
            <td><span class="month-cell">${monthLabelShort(d.year, d.month)}</span></td>
            <td>${formatCurrency(d.valor)}</td>
            <td>${formatCurrency(div)}</td>
            <td>${idx > 0 ? formatCurrency(suggestedForMonth) : '—'}</td>
            <td>
                <button class="btn-icon btn-edit" onclick="editAporteMonth(${d.year}, ${d.month})" title="Editar">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 10.5V12H3.5L10.2 5.3L8.7 3.8L2 10.5ZM11.8 3.7C12 3.5 12 3.2 11.8 3L11 2.2C10.8 2 10.5 2 10.3 2.2L9.5 3L11 4.5L11.8 3.7Z" fill="currentColor"/></svg>
                </button>
                <button class="btn-icon btn-delete" onclick="deleteAporteMonth('${k}')" title="Excluir">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4H11L10.3 12H3.7L3 4ZM5 2H9M2 4H12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                </button>
            </td>
        </tr>`;
    }).join('');
}

function editAporteMonth(year, month) {
    currentAporteMonth = { year, month };
    renderAporte();
    document.querySelector('.aporte-input-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteAporteMonth(key) {
    if (!confirm('Deseja realmente excluir este aporte?')) return;
    const data = getAporteData();
    delete data[key];
    saveData('byfinance_aportes', data);
    renderAporte();
    showToast('Aporte removido', 'info');
}

// ============================================================
// MENU MOBILE
// ============================================================
function toggleMenu() {
    const hamburger = document.getElementById('menuHamburger');
    const dropdown = document.getElementById('menuDropdown');
    
    hamburger.classList.toggle('active');
    dropdown.classList.toggle('open');
}

function toggleImportExportMenu() {
    const dropdown = document.getElementById('menuDropdownDesktop');
    const button = document.getElementById('btnImportExport');
    const isOpen = dropdown.classList.contains('open');
    
    if (isOpen) {
        dropdown.classList.remove('open');
        button.classList.remove('active');
    } else {
        dropdown.classList.add('open');
        button.classList.add('active');
    }
}

function closeImportExportMenu() {
    const dropdown = document.getElementById('menuDropdownDesktop');
    const button = document.getElementById('btnImportExport');
    if (dropdown) dropdown.classList.remove('open');
    if (button) button.classList.remove('active');
}

// Fechar os menus ao clicar fora
document.addEventListener('click', function(event) {
    const hamburger = document.getElementById('menuHamburger');
    const dropdown = document.getElementById('menuDropdown');
    const btnImportExport = document.getElementById('btnImportExport');
    const dropdownDesktop = document.getElementById('menuDropdownDesktop');
    const importExportContainer = document.getElementById('importExportContainer');
    
    // Fechar menu móvel ao clicar fora do hamburguer e do dropdown
    if (hamburger && dropdown) {
        if (!hamburger.contains(event.target) && !dropdown.contains(event.target)) {
            hamburger.classList.remove('active');
            dropdown.classList.remove('open');
        }
    }
    
    // Fechar menu desktop ao clicar fora do container inteiro (botão + dropdown)
    if (importExportContainer && !importExportContainer.contains(event.target)) {
        closeImportExportMenu();
    }
});

// ============================================================
// IMPORT / EXPORT
// ============================================================
function exportData() {
    const allData = {
        kraken: loadData('byfinance_kraken', {}),
        proventos: loadData('byfinance_proventos', {}),
        aportes: loadData('byfinance_aportes', {}),
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `byfinance_backup_${new Date().toISOString().slice(0, 10)}.json`;
    // Necessário adicionar ao DOM para funcionar em iOS/Safari mobile
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Dados exportados com sucesso!');
}

function importData() {
    // Fechar ambos os menus antes de acionar o file input
    // O setTimeout garante que o menu feche primeiro e o browser
    // trate o .click() como evento direto de usuário (necessário em mobile)
    closeMenu();
    closeImportExportMenu();
    setTimeout(() => {
        document.getElementById('importFileInput').click();
    }, 150);
}

function closeMenu() {
    const hamburger = document.getElementById('menuHamburger');
    const dropdown = document.getElementById('menuDropdown');
    if (hamburger) hamburger.classList.remove('active');
    if (dropdown) dropdown.classList.remove('open');
}

function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validação básica antes de ler
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
        showToast('Selecione um arquivo .json válido', 'error');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
        // Resetar o input APÓS a leitura concluir (não antes — mobile cancela a leitura)
        event.target.value = '';

        let parsed = null;

        try {
            const raw = e.target.result;
            if (!raw || raw.trim() === '') {
                showToast('Arquivo vazio ou inválido', 'error');
                return;
            }

            const data = JSON.parse(raw);

            // Verificar se é um backup FastInvest válido
            if (!data.kraken && !data.proventos && !data.aportes) {
                showToast('Arquivo não parece ser um backup do FastInvest', 'error');
                return;
            }

            if (data.kraken)    saveData('byfinance_kraken', data.kraken);
            if (data.proventos) saveData('byfinance_proventos', data.proventos);
            if (data.aportes)   saveData('byfinance_aportes', data.aportes);

            parsed = true;
        } catch (err) {
            console.error('Erro ao importar:', err);
            showToast('Erro ao ler o arquivo. Verifique se é um JSON válido.', 'error');
            return;
        }

        // initDashboard fora do try/catch — erros de renderização (canvas, etc.)
        // não devem aparecer como "erro ao importar"
        if (parsed) {
            showToast('Dados importados com sucesso!');
            setTimeout(() => initDashboard(), 100);
        }
    };

    reader.onerror = function () {
        event.target.value = '';
        showToast('Não foi possível ler o arquivo', 'error');
    };

    reader.readAsText(file, 'UTF-8');
}

// ============================================================
// WINDOW EVENTS
// ============================================================
window.addEventListener('resize', () => {
    updateTabIndicator();
    // Re-render pie chart on resize
    const data = getProventosData();
    renderProventosPieChart(data);
});

// Init on load
window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initParticles();
    initMouseGlow();

    // Sempre mostrar a landing page primeiro (removido auto-enter do dashboard)
    // const hasData = localStorage.getItem('byfinance_kraken') ||
    //                 localStorage.getItem('byfinance_proventos') ||
    //                 localStorage.getItem('byfinance_aportes');
    // if (hasData) {
    //     enterDashboard();
    // }
});

// ============================================================
// MOUSE GLOW EFFECT
// ============================================================
function initMouseGlow() {
    document.getElementById('dashboard').addEventListener('mousemove', e => {
        for(const card of document.querySelectorAll('.card, .stat-card, .category-card')) {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        }
    });
}

// ============================================================
// THEME TOGGLE
// ============================================================
function initTheme() {
    const saved = localStorage.getItem('byfinance_theme');
    if (saved === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        updateThemeMeta('light');
    } else {
        document.documentElement.removeAttribute('data-theme');
        updateThemeMeta('dark');
    }
}

function toggleTheme() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('byfinance_theme', 'dark');
        updateThemeMeta('dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('byfinance_theme', 'light');
        updateThemeMeta('light');
    }
    // Re-render chart with new theme colors
    const data = getProventosData();
    renderProventosPieChart(data);
}

function updateThemeMeta(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute('content', theme === 'light' ? '#FEF7ED' : '#0A0A0A');
    }
}
