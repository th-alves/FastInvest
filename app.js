// ============================================================
// FastInvest — App Logic
// All data persisted in LocalStorage
// ============================================================

// ===================== CONSTANTS =====================
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
let currentCalcType = null; // 'fii' | 'acao' | 'gordon'
let gordonG = 6;             // crescimento esperado dos dividendos (%)
let gordonPremium = 2;       // prêmio de risco sobre a taxa base (%)
let gordonBase = 'tesouro';  // 'tesouro' | 'ifix'

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

function handleCurrencyInput(input) {
    let raw = input.value.replace(/[^\d]/g, '');
    if (raw === '') { input.value = ''; return; }
    let num = parseInt(raw, 10) / 100;
    input.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    if (tabName === 'metas') renderMetas();
    if (tabName === 'patrimonio') renderProventos();
    if (tabName === 'proventos') renderProventos();
    if (tabName === 'aporte') renderAporte();
    if (tabName === 'calc') { calcLoadState(); calcAll(); }
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
    renderMetas();
    renderProventos();
    renderAporte();
    setTimeout(updateTabIndicator, 50);
}

// ============================================================
// DADOS DE METAS / PATRIMÔNIO
// (nome "kraken" mantido internamente por compatibilidade com
// backups já exportados pelos usuários — armazena a Meta de
// Dividendos, a Meta Patrimonial e o Patrimônio Total)
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
    // patrimonioTotal não tem campo próprio no formulário — ele é gerido
    // exclusivamente por syncPatrimonioTotalFromProventos() a partir do Saldo
    // Bruto informado em Proventos, então preservamos o valor já salvo aqui.
    data.projecaoMeta = parseCurrencyInput(document.getElementById('projecaoMeta').value) || 50000;
    saveData('byfinance_kraken', data);
}

// ============================================================
// TAB: METAS
// ============================================================

function renderMetas() {
    const krakenData = getKrakenData();
    const proventosData = getProventosData();
    const keys = Object.keys(proventosData).sort();

    // Popula os campos de meta a partir do que já foi salvo
    const goalInput = document.getElementById('dividendGoal');
    if (goalInput) {
        goalInput.value = krakenData.dividendGoal > 0
            ? krakenData.dividendGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '';
    }
    const projecaoInput = document.getElementById('projecaoMeta');
    if (projecaoInput) {
        projecaoInput.value = krakenData.projecaoMeta > 0
            ? krakenData.projecaoMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '';
    }

    // --- Meta de Dividendos Mensais: último mês registrado vs. meta ---
    const divGoal = Number(krakenData.dividendGoal) || 0;
    const divWrap = document.getElementById('metasDividendBarWrap');
    if (divWrap) {
        if (divGoal > 0 && keys.length > 0) {
            const lastDiv = proventosData[keys[keys.length - 1]].dividendos || 0;
            const pct = Math.min((lastDiv / divGoal) * 100, 100);
            divWrap.style.display = '';
            document.getElementById('metasDividendBarFill').style.width = pct.toFixed(1) + '%';
            document.getElementById('metasDividendBarFill').style.background = lastDiv >= divGoal ? '#22c55e' : 'var(--primary-gradient)';
            document.getElementById('metasDividendBarLabel').textContent =
                formatCurrency(lastDiv) + ' / ' + formatCurrency(divGoal) + ' (' + pct.toFixed(0) + '% do último mês)';
        } else {
            divWrap.style.display = 'none';
        }
    }

    // --- Meta Patrimonial: patrimônio atual (sincronizado via Proventos) vs. meta ---
    const patrimonio = Number(krakenData.patrimonioTotal) || 0;
    const meta = Number(krakenData.projecaoMeta) || 0;
    const patWrap = document.getElementById('metasPatrimonioBarWrap');
    if (patWrap) {
        if (meta > 0 && patrimonio > 0) {
            const pct = Math.min((patrimonio / meta) * 100, 100);
            patWrap.style.display = '';
            document.getElementById('metasPatrimonioBarFill').style.width = pct.toFixed(1) + '%';
            document.getElementById('metasPatrimonioBarFill').style.background = patrimonio >= meta ? '#22c55e' : 'var(--primary-gradient)';
            document.getElementById('metasPatrimonioBarLabel').textContent =
                formatCurrency(patrimonio) + ' / ' + formatCurrency(meta) + ' (' + pct.toFixed(0) + '%)';
        } else {
            patWrap.style.display = 'none';
        }
    }
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
    const mirror = document.getElementById('proventosCurrentMonthMirror');
    if (mirror) mirror.textContent = monthLabel(currentProventosMonth.year, currentProventosMonth.month);

    // Fill form
    setInputValue('provValorAplicado', monthData.valorAplicado);
    setInputValue('provSaldoBruto', monthData.saldoBruto);
    setInputValue('provDividendos', monthData.dividendos);
    setInputValue('provDividendosFII', monthData.dividendosFII);
    setInputValue('provValorFII', monthData.valorFII);

    // Show calc cards independentemente: um para Patrimônio (Ganho Capital/Performance),
    // outro para Proventos (Yield FIIs) — cada um só aparece se tiver dado próprio.
    const hasPatrimonioData = monthData.valorAplicado || monthData.saldoBruto;
    const hasProventosData = monthData.dividendos || monthData.valorFII || monthData.dividendosFII;

    if (hasPatrimonioData || hasProventosData) {
        updateProventosCalc(monthData, key, data);
    }

    const patrimonioCalcCard = document.getElementById('patrimonioCalcCard');
    if (patrimonioCalcCard) {
        if (hasPatrimonioData) {
            patrimonioCalcCard.style.display = '';
            document.getElementById('calcMonthBadge').textContent = monthLabelShort(currentProventosMonth.year, currentProventosMonth.month);
        } else {
            patrimonioCalcCard.style.display = 'none';
        }
    }

    const proventosCalcCard = document.getElementById('proventosCalcCard');
    if (proventosCalcCard) {
        if (hasProventosData) {
            proventosCalcCard.style.display = '';
            document.getElementById('calcMonthBadgeProventos').textContent = monthLabelShort(currentProventosMonth.year, currentProventosMonth.month);
        } else {
            proventosCalcCard.style.display = 'none';
        }
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

// Salva apenas Valor Aplicado + Saldo Bruto do mês, preservando os campos
// de proventos que já estejam gravados nesse mesmo registro.
function savePatrimonioMonth() {
    const data = getProventosData();
    const key = monthKey(currentProventosMonth.year, currentProventosMonth.month);
    const existing = data[key] || {};

    data[key] = {
        ...existing,
        year: currentProventosMonth.year,
        month: currentProventosMonth.month,
        valorAplicado: parseCurrencyInput(document.getElementById('provValorAplicado').value),
        saldoBruto: parseCurrencyInput(document.getElementById('provSaldoBruto').value)
    };

    saveData('byfinance_proventos', data);

    // Sincroniza automaticamente o "Patrimônio Total" (usado nas Metas)
    // com o Saldo Bruto do mês mais recente informado aqui.
    syncPatrimonioTotalFromProventos(data);

    renderProventos();
    renderAporte();
    renderMetas();
    showToast('Patrimônio do mês salvo com sucesso!');
}

// Salva apenas os campos de proventos/dividendos do mês, preservando o que
// já estiver gravado de Valor Aplicado / Saldo Bruto nesse mesmo registro.
function saveProventosMonth() {
    const data = getProventosData();
    const key = monthKey(currentProventosMonth.year, currentProventosMonth.month);
    const existing = data[key] || {};

    data[key] = {
        ...existing,
        year: currentProventosMonth.year,
        month: currentProventosMonth.month,
        dividendos: parseCurrencyInput(document.getElementById('provDividendos').value),
        dividendosFII: parseCurrencyInput(document.getElementById('provDividendosFII').value),
        valorFII: parseCurrencyInput(document.getElementById('provValorFII').value)
    };

    saveData('byfinance_proventos', data);

    renderProventos();
    renderAporte();
    renderMetas();
    showToast('Proventos do mês salvos com sucesso!');
}

// Mantém krakenData.patrimonioTotal sempre igual ao Saldo Bruto do mês mais
// recente com dado preenchido, evitando digitar o mesmo valor em dois lugares.
function syncPatrimonioTotalFromProventos(proventosData) {
    const keys = Object.keys(proventosData).sort();
    if (keys.length === 0) return;
    const lastKey = keys[keys.length - 1];
    const lastSaldo = proventosData[lastKey].saldoBruto || 0;
    if (lastSaldo <= 0) return;

    const krakenData = getKrakenData();
    krakenData.patrimonioTotal = lastSaldo;
    saveData('byfinance_kraken', krakenData);
}

function updateProventosCalc(monthData, key, allData) {
    const va = monthData.valorAplicado || 0;
    const sb = monthData.saldoBruto || 0;
    const divFII = monthData.dividendosFII || 0;
    const valFII = monthData.valorFII || 0;

    const ganhoCapR = sb - va;
    const ganhoCapPct = va > 0 ? (ganhoCapR / va) * 100 : 0;
    const yieldFII = valFII > 0 ? (divFII / valFII) * 100 : 0;

    // Performance: (Ganho de Capital + Total de Proventos) / Saldo Bruto
    // Equivalente à planilha: (D1 + C13) / B1
    let totalProventos = 0;
    Object.keys(allData).forEach(k => { totalProventos += (allData[k].dividendos || 0); });
    let performance = null;
    if (sb > 0) {
        performance = ((ganhoCapR + totalProventos) / sb) * 100;
    }

    document.getElementById('calcGanhoCapital').textContent = formatCurrency(ganhoCapR);
    document.getElementById('calcGanhoCapitalPct').textContent = formatPercent(ganhoCapPct);
    document.getElementById('calcYieldFII').textContent = formatPercent(yieldFII);
    const perfEl = document.getElementById('calcPerformance');
    perfEl.textContent = performance !== null ? formatPercent(performance) : '—';
    perfEl.className = performance !== null ? (performance >= 0 ? 'positive' : 'negative') : '';
}

function updateProventosSummary(data) {
    const keys = Object.keys(data).sort();
    let totalProventos = 0;
    let lastGanhoCapR = 0;
    let lastGanhoCapPct = 0;
    let lastYield = 0;
    let lastPerformance = 0;
    let lastSaldoBruto = 0;

    keys.forEach(k => {
        totalProventos += (data[k].dividendos || 0);
    });

    if (keys.length > 0) {
        const last = data[keys[keys.length - 1]];
        const va = last.valorAplicado || 0;
        const sb = last.saldoBruto || 0;
        lastSaldoBruto = sb;
        const ganhoCapR = sb - va;
        lastGanhoCapR = ganhoCapR;
        lastGanhoCapPct = va > 0 ? (lastGanhoCapR / va) * 100 : 0;
        lastYield = (last.valorFII || 0) > 0 ? ((last.dividendosFII || 0) / (last.valorFII || 1)) * 100 : 0;

        // Performance: (Ganho de Capital + Total de Proventos) / Saldo Bruto
        if (sb > 0) {
            lastPerformance = ((ganhoCapR + totalProventos) / sb) * 100;
        }
    }

    document.getElementById('totalProventos').textContent = formatCurrency(totalProventos);
    document.getElementById('proventosCapitalGain').textContent = formatCurrency(lastGanhoCapR);
    document.getElementById('proventosCapitalGainPct').textContent = formatPercent(lastGanhoCapPct);
    document.getElementById('lastYieldFII').textContent = formatPercent(lastYield);
    document.getElementById('lastPerformance').textContent = formatPercent(lastPerformance);

    // --- Hero: Patrimônio Total (= Saldo Bruto do mês mais recente) ---
    const heroValue = document.getElementById('patrimonioTotalHero');
    const heroDelta = document.getElementById('patrimonioTotalDelta');
    if (heroValue) heroValue.textContent = formatCurrency(lastSaldoBruto);
    if (heroDelta) {
        if (keys.length > 1) {
            const prevSaldo = data[keys[keys.length - 2]].saldoBruto || 0;
            if (prevSaldo > 0) {
                const diff = lastSaldoBruto - prevSaldo;
                const diffPct = (diff / prevSaldo) * 100;
                heroDelta.textContent = (diff >= 0 ? '+' : '') + formatCurrency(diff) + ' (' + (diffPct >= 0 ? '+' : '') + diffPct.toFixed(2).replace('.', ',') + '%) vs. mês anterior';
                heroDelta.className = 'patrimonio-hero-delta ' + (diff >= 0 ? 'positive' : 'negative');
            } else {
                heroDelta.textContent = '';
            }
        } else {
            heroDelta.textContent = '';
        }
    }

    // Barra vs. Meta Patrimonial dentro do hero
    const heroMetaWrap = document.getElementById('patrimonioHeroMetaWrap');
    if (heroMetaWrap) {
        const krakenData = getKrakenData();
        const meta = Number(krakenData.projecaoMeta) || 0;
        if (meta > 0 && lastSaldoBruto > 0) {
            const pct = Math.min((lastSaldoBruto / meta) * 100, 100);
            heroMetaWrap.style.display = '';
            document.getElementById('patrimonioHeroBarFill').style.width = pct.toFixed(1) + '%';
            document.getElementById('patrimonioHeroBarFill').style.background = lastSaldoBruto >= meta ? '#22c55e' : 'var(--primary-gradient)';
            document.getElementById('patrimonioHeroBarLabel').textContent =
                pct.toFixed(0) + '% da Meta Patrimonial (' + formatCurrency(meta) + ')';
        } else {
            heroMetaWrap.style.display = 'none';
        }
    }

    updateGoalBar(totalProventos);
    updateProjectionAndYoY(data);
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

        // Δ: variação do saldo bruto em relação ao mês anterior
        let deltaR = '—';
        let deltaPct = '—';
        if (idx > 0) {
            const prevSB = data[keys[idx - 1]]?.saldoBruto || 0;
            const dr = sb - prevSB;
            const arrow = dr >= 0 ? ' ↑' : ' ↓';
            deltaR = formatCurrency(dr) + arrow;
            deltaPct = prevSB > 0 ? formatPercent((dr / prevSB) * 100) + arrow : '—';
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
            <td class="${idx > 0 ? (sb - (data[keys[idx-1]]?.saldoBruto||0) >= 0 ? 'positive' : 'negative') : ''}">${deltaR}</td>
            <td class="${idx > 0 ? (sb - (data[keys[idx-1]]?.saldoBruto||0) >= 0 ? 'positive' : 'negative') : ''}">${deltaPct}</td>
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
    showConfirmModal('Deseja realmente excluir os dados deste mês?', () => {
        const data = getProventosData();
        delete data[key];
        saveData('byfinance_proventos', data);
        renderProventos();
        renderAporte();
        showToast('Dados do mês removidos', 'info');
    });
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
    showConfirmModal('Deseja realmente excluir este aporte?', () => {
        const data = getAporteData();
        delete data[key];
        saveData('byfinance_aportes', data);
        renderAporte();
        showToast('Aporte removido', 'info');
    });
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

    // Keyboard shortcuts: P, A, C to switch tabs
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'p' || e.key === 'P') switchTab('proventos');
        if (e.key === 'a' || e.key === 'A') switchTab('aporte');
        if (e.key === 'c' || e.key === 'C') switchTab('calc');
    });
});

// ============================================================
// MOUSE GLOW EFFECT
// ============================================================
function initMouseGlow() {
    document.getElementById('dashboard').addEventListener('mousemove', e => {
        for(const card of document.querySelectorAll('.card, .stat-card')) {
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

// ============================================================
// META DE DIVIDENDOS + PROJEÇÃO + YoY + MELHOR MÊS + CONFIRM DELETE
// ============================================================

function updateGoalBar(totalProventos) {
    const krakenData = getKrakenData();
    const goal = Number(krakenData.dividendGoal) || 0;
    const wrap = document.getElementById('goalBarWrap');
    if (!wrap) return;
    if (goal <= 0) { wrap.style.display = 'none'; return; }

    // Lógica: quantos dos últimos 6 meses bateram a meta?
    const data = getProventosData();
    const keys = Object.keys(data).sort();
    const recent = keys.slice(-6);
    const bateram = recent.filter(k => (data[k].dividendos || 0) >= goal).length;
    const total = recent.length;
    const lastDiv = total > 0 ? (data[recent[recent.length - 1]].dividendos || 0) : 0;
    const pctBarra = Math.min((lastDiv / goal) * 100, 100);
    const metaConcluida = total >= 6 && bateram === total;

    wrap.style.display = '';
    document.getElementById('goalBarFill').style.width = pctBarra.toFixed(1) + '%';
    document.getElementById('goalBarFill').style.background = metaConcluida ? '#22c55e' : 'var(--primary-gradient)';

    const lastFormatted = formatCurrency(lastDiv) + ' / ' + formatCurrency(goal);
    const streak = metaConcluida
        ? '🎯 Meta atingida! ' + bateram + '/' + total + ' meses'
        : bateram + '/' + total + ' meses acima de ' + formatCurrency(goal);
    document.getElementById('goalBarLabel').textContent = lastFormatted + ' — ' + streak;
}

function updateProjectionAndYoY(data) {
    const keys = Object.keys(data).sort();
    const projRow = document.getElementById('projectionRowPatrimonio');
    const yoyRow = document.getElementById('yoyRowProventos');
    if (keys.length < 2) {
        if (projRow) projRow.style.display = 'none';
        if (yoyRow) yoyRow.style.display = 'none';
        return;
    }
    if (projRow) projRow.style.display = '';
    if (yoyRow) yoyRow.style.display = '';

    // Projeção: média de aportes dos últimos 3 meses * meses restantes até meta patrimonial
    const krakenData = getKrakenData();
    const patrimonioAtual = krakenData.patrimonioTotal || 0;
    const last = data[keys[keys.length - 1]];
    const recentKeys = keys.slice(-3);
    const avgAporte = recentKeys.reduce((sum, k) => {
        const aporteData = getAporteData();
        return sum + (aporteData[k]?.valor || 0);
    }, 0) / recentKeys.length;
    const avgRendimento = recentKeys.reduce((sum, k) => {
        const d = data[k];
        return sum + ((d.saldoBruto - d.valorAplicado) / (d.valorAplicado || 1));
    }, 0) / recentKeys.length;
    const META = Number(krakenData.projecaoMeta) || 50000;
    let proj = patrimonioAtual;
    let meses = 0;
    while (proj < META && meses < 600) { proj = proj * (1 + avgRendimento) + avgAporte; meses++; }
    const projEl = document.getElementById('projectionValue');
    const projSub = document.getElementById('projectionMonths');
    if (meses < 600 && avgAporte > 0) {
        projEl.textContent = meses + ' meses';
        projSub.textContent = 'para ' + formatCurrency(META) + ' (aporte médio ' + formatCurrency(avgAporte) + '/mês)';
    } else {
        projEl.textContent = '—';
        projSub.textContent = 'Registre mais aportes para projetar';
    }

    // YoY: dividendos do mês atual vs mesmo mês do ano anterior
    const cur = keys[keys.length - 1];
    const curData = data[cur];
    const yoyKey = monthKey(curData.year - 1, curData.month);
    const yoyData = data[yoyKey];
    const yoyEl = document.getElementById('yoyDividendos');
    const yoyPct = document.getElementById('yoyDividendosPct');
    if (yoyData) {
        const diff = curData.dividendos - yoyData.dividendos;
        const pct = yoyData.dividendos > 0 ? (diff / yoyData.dividendos) * 100 : 0;
        yoyEl.textContent = formatCurrency(curData.dividendos) + ' vs ' + formatCurrency(yoyData.dividendos);
        yoyEl.className = 'stat-value ' + (diff >= 0 ? 'positive' : 'negative');
        yoyPct.textContent = (diff >= 0 ? '+' : '') + pct.toFixed(1) + '% em relação a ' + monthLabelShort(yoyData.year, yoyData.month);
        yoyPct.className = 'stat-sub ' + (diff >= 0 ? 'positive' : 'negative');
    } else {
        yoyEl.textContent = '—';
        yoyEl.className = 'stat-value';
        yoyPct.textContent = 'Sem dados do mesmo mês no ano anterior';
        yoyPct.className = 'stat-sub';
    }
}

function showConfirmModal(message, onConfirm) {
    let modal = document.getElementById('confirmModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirmModal';
        modal.className = 'confirm-modal-overlay';
        modal.innerHTML = `
            <div class="confirm-modal">
                <p class="confirm-modal-msg" id="confirmModalMsg"></p>
                <div class="confirm-modal-actions">
                    <button class="btn-secondary" onclick="document.getElementById('confirmModal').style.display='none'">Cancelar</button>
                    <button class="btn-danger" id="confirmModalOk">Excluir</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
    }
    document.getElementById('confirmModalMsg').textContent = message;
    document.getElementById('confirmModalOk').onclick = () => { modal.style.display = 'none'; onConfirm(); };
    modal.style.display = 'flex';
}

// ============================================================
// TAB 4: CALCULADORAS DE PREÇO TETO
// ============================================================

function parseBR(str) {
    if (!str && str !== 0) return null;
    const s = String(str).trim();
    if (s === '') return null;
    // Remove thousand separators (dots when followed by 3 digits) then normalize decimal
    let normalized = s.replace(/\.(?=\d{3}(?:[,.]|$))/g, '').replace(',', '.');
    const v = parseFloat(normalized);
    return isNaN(v) || v <= 0 ? null : v;
}

// Máscara para campos de MOEDA (R$): funciona como um caixa eletrônico,
// deslocando os dígitos e sempre mantendo N casas decimais fixas ao final.
// Ex.: digitar "1291" vira "12,91"; digitar "1234567" vira "12.345,67".
// Ideal para preço, DPA, LPA, VPA — onde o usuário pensa em "reais e centavos".
function maskCurrencyInput(el, decimals = 2) {
    let digits = el.value.replace(/\D/g, '');
    if (!digits) { el.value = ''; return; }
    digits = digits.replace(/^0+(?=\d)/, '');       // remove zeros à esquerda supérfluos
    while (digits.length <= decimals) digits = '0' + digits; // garante casas decimais mínimas
    const intPart = digits
        .slice(0, digits.length - decimals)
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.');     // ponto de milhar
    const decPart = digits.slice(digits.length - decimals);
    el.value = intPart + ',' + decPart;
    el.setSelectionRange(el.value.length, el.value.length);
}

// Máscara leve para campos de PERCENTUAL/ÍNDICE (taxas, crescimento, P/L etc.):
// não desloca dígitos (então digitar "10" continua "10", não vira "0,10") —
// só troca "." por "," automaticamente e bloqueia caracteres inválidos,
// pra você não precisar procurar a vírgula no teclado manualmente.
function maskPercentInput(el) {
    let v = el.value.replace(',', '.').replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
        v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
    }
    el.value = v.replace('.', ',');
}

function setCalcType(type) {
    currentCalcType = type;
    document.querySelectorAll('.calc-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    const fiiPanel    = document.getElementById('calcInputsFII');
    const acaoPanel   = document.getElementById('calcInputsAcao');
    const gordonPanel = document.getElementById('calcInputsGordon');
    const resultsWrap = document.getElementById('calcResults');
    if (fiiPanel)    fiiPanel.style.display    = type === 'fii'    ? '' : 'none';
    if (acaoPanel)   acaoPanel.style.display   = type === 'acao'   ? '' : 'none';
    if (gordonPanel) gordonPanel.style.display = type === 'gordon' ? '' : 'none';
    // A ferramenta Gordon Ajustado tem seus próprios resultados embutidos no widget
    if (resultsWrap) resultsWrap.style.display = type === 'gordon' ? 'none' : '';
    calcSaveState();
    if (type === 'gordon') { gordonCompute(); } else { calcAll(); }
}

function calcSaveState() {
    const fields = ['calcTicker','calcPreco','calcDPA','calcRetorno','calcG',
                    'calcTickerAcao','calcPrecoAcao','calcLPA','calcVPA','calcCrescimento','calcPLSetor',
                    'gTicker','gPreco','gDPA','gBondPreset','gCustomRate','gIfixRate','gIpcaRate'];
    const state = { type: currentCalcType, gordonG, gordonPremium, gordonBase };
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) state[id] = el.value || '';
    });
    const customIsReal = document.getElementById('gCustomIsReal');
    if (customIsReal) state.gCustomIsReal = customIsReal.checked;
    saveData('byfinance_calc', state);
}

function calcLoadState() {
    const state = loadData('byfinance_calc', {});
    const fields = ['calcTicker','calcPreco','calcDPA','calcRetorno','calcG',
                    'calcTickerAcao','calcPrecoAcao','calcLPA','calcVPA','calcCrescimento','calcPLSetor',
                    'gTicker','gPreco','gDPA','gBondPreset','gCustomRate','gIfixRate','gIpcaRate'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el && state[id] !== undefined) el.value = state[id];
    });
    if (typeof state.gordonG === 'number') gordonG = state.gordonG;
    if (typeof state.gordonPremium === 'number') gordonPremium = state.gordonPremium;
    if (state.gordonBase) gordonBase = state.gordonBase;
    if (state.gBondPreset) {
        const sel = document.getElementById('gBondPreset');
        if (sel) sel.value = state.gBondPreset;
    }
    const customIsReal = document.getElementById('gCustomIsReal');
    if (customIsReal && typeof state.gCustomIsReal === 'boolean') customIsReal.checked = state.gCustomIsReal;
    gordonSyncUI();
    if (state.type) setCalcType(state.type);
}

function calcAll() {
    const empty = document.getElementById('calcEmpty');
    const table = document.getElementById('calcResultsTable');

    if (!currentCalcType) {
        if (empty) empty.style.display = 'flex';
        if (table) table.style.display = 'none';
        return;
    }

    const results = [];

    if (currentCalcType === 'fii') {
        const preco   = parseBR(document.getElementById('calcPreco')?.value);
        const dpa     = parseBR(document.getElementById('calcDPA')?.value);
        const retorno = parseBR(document.getElementById('calcRetorno')?.value) || 6;
        const g       = parseBR(document.getElementById('calcG')?.value) || 3;
        if (dpa)
            results.push({ metodo: 'Bazin', teto: dpa / (retorno / 100), nota: `DPA ÷ ${retorno}%`, preco });
        if (dpa && retorno > g)
            results.push({ metodo: 'Gordon (DDM)', teto: dpa / ((retorno - g) / 100), nota: `DPA ÷ (${retorno}% − ${g}%)`, preco });
    }

    if (currentCalcType === 'acao') {
        const preco   = parseBR(document.getElementById('calcPrecoAcao')?.value);
        const lpa     = parseBR(document.getElementById('calcLPA')?.value);
        const vpa     = parseBR(document.getElementById('calcVPA')?.value);
        const cresc   = parseBR(document.getElementById('calcCrescimento')?.value);
        const plSetor = parseBR(document.getElementById('calcPLSetor')?.value);
        if (lpa && vpa && lpa * vpa > 0)
            results.push({ metodo: 'Graham', teto: Math.sqrt(22.5 * lpa * vpa), nota: '√(22,5 × LPA × VPA)', preco });
        if (lpa && cresc) {
            const peg = preco ? (preco / lpa) / cresc : null;
            results.push({ metodo: 'Peter Lynch', teto: lpa * cresc, nota: peg ? `PEG atual: ${peg.toFixed(2)}` : 'LPA × crescimento', preco });
        }
        if (lpa && plSetor)
            results.push({ metodo: 'P/L Justo', teto: lpa * plSetor, nota: `LPA × P/L ${plSetor}`, preco });
    }

    if (results.length === 0) {
        if (empty) empty.style.display = 'flex';
        if (table) table.style.display = 'none';
        return;
    }
    if (empty) empty.style.display = 'none';
    if (table) table.style.display = '';

    const metodoInfo = {
        'Bazin':        'Focado em renda. Preço teto = DPA ÷ retorno mínimo. Ideal para FIIs com dividendos consistentes.',
        'Gordon (DDM)': 'Preço justo = DPA ÷ (k − g). Modela o valor presente dos dividendos futuros com crescimento constante.',
        'Graham':       'Valor intrínseco = √(22,5 × LPA × VPA). Busca ações baratas com sólida base patrimonial.',
        'Peter Lynch':  'PEG Ratio = P/L ÷ crescimento do LPA. Barato quando PEG < 1, caro quando PEG > 2.',
        'P/L Justo':    'Preço teto = LPA × P/L médio do setor. Bom para comparar empresas do mesmo segmento.'
    };

    const tbody = document.getElementById('calcTableBody');
    tbody.innerHTML = results.map(r => {
        const margem = r.preco ? ((r.teto - r.preco) / r.preco) * 100 : null;
        const { cls, label } = calcVeredito(r.teto, r.preco);
        const tooltip = metodoInfo[r.metodo] || '';
        return `<tr>
            <td>
                <div class="calc-method-cell">
                    <span class="calc-method-tag">${r.metodo}</span>
                    <span class="calc-tooltip-wrap"><span class="calc-tooltip-icon" data-tooltip="${tooltip}">?</span></span>
                </div>
                <span class="calc-nota">${r.nota}</span>
            </td>
            <td class="positive"><strong>${formatCurrency(r.teto)}</strong></td>
            <td>${r.preco ? formatCurrency(r.preco) : '—'}</td>
            <td class="${margem !== null ? (margem >= 0 ? 'positive' : 'negative') : ''}">
                ${margem !== null ? (margem >= 0 ? '+' : '') + margem.toFixed(1) + '% de margem' : '—'}
            </td>
            <td><span class="calc-veredito ${cls}">${label}</span></td>
        </tr>`;
    }).join('');

    const precoRef    = results[0].preco;
    const media       = results.reduce((s, r) => s + r.teto, 0) / results.length;
    const margemMedia = precoRef ? ((media - precoRef) / precoRef) * 100 : null;
    const { cls: clsM, label: labelM } = calcVeredito(media, precoRef);
    document.getElementById('calcAverageCard').innerHTML = `
        <div class="calc-average-inner">
            <div>
                <span class="calc-average-label">Média dos ${results.length} métodos</span>
                <span class="calc-average-value positive">${formatCurrency(media)}</span>
            </div>
            <div>
                <span class="calc-average-label">Margem média</span>
                <span class="calc-average-value ${margemMedia !== null ? (margemMedia >= 0 ? 'positive' : 'negative') : ''}">
                    ${margemMedia !== null ? (margemMedia >= 0 ? '+' : '') + margemMedia.toFixed(1) + '%' : '—'}
                </span>
            </div>
            <span class="calc-veredito ${clsM} calc-veredito-lg">${labelM}</span>
        </div>`;
}

function calcVeredito(teto, preco) {
    if (!preco) return { cls: 'veredito-neutral', label: '—' };
    const diff = ((teto - preco) / preco) * 100;
    if (diff >= 20)  return { cls: 'veredito-buy',     label: '✓ Compra' };
    if (diff >= 0)   return { cls: 'veredito-watch',   label: '◎ Atenção' };
    return              { cls: 'veredito-sell',    label: '✕ Caro' };
}

// ============================================================
// WIDGET: VALUATION PELO MODELO DE GORDON AJUSTADO
// P0 = D1 / (k - g), onde k = taxa base líquida + prêmio de risco
// ============================================================

function toggleGordonSettings() {
    const panel = document.getElementById('gordonSettings');
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? '' : 'none';
}

function setGordonBase(base) {
    gordonBase = base;
    document.querySelectorAll('.gordon-base-opt').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.base === base);
    });
    gordonSyncUI();
    calcSaveState();
    gordonCompute();
}

function gordonPresetChange() {
    const sel = document.getElementById('gBondPreset');
    const isCustom = sel && sel.value === 'custom';
    const customRow     = document.getElementById('gordonCustomRow');
    const customTypeRow = document.getElementById('gordonCustomTypeRow');
    const ipcaRow        = document.getElementById('gordonIpcaRow');
    if (customRow)     customRow.style.display     = isCustom ? '' : 'none';
    if (customTypeRow) customTypeRow.style.display = isCustom ? '' : 'none';

    let isReal;
    if (isCustom) {
        isReal = !!document.getElementById('gCustomIsReal')?.checked;
    } else {
        const opt = sel ? sel.options[sel.selectedIndex] : null;
        isReal = opt ? opt.dataset.type === 'real' : false;
    }
    if (ipcaRow) ipcaRow.style.display = isReal ? '' : 'none';

    calcSaveState();
    gordonCompute();
}

function gordonStep(field, delta) {
    if (field === 'g') {
        gordonG = Math.max(0, Math.round((gordonG + delta) * 10) / 10);
    } else if (field === 'premium') {
        gordonPremium = Math.max(0, Math.round((gordonPremium + delta) * 10) / 10);
    }
    calcSaveState();
    gordonCompute();
}

// Sincroniza os elementos visuais (steppers, painel base, linhas condicionais) com o estado atual
function gordonSyncUI() {
    document.querySelectorAll('.gordon-base-opt').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.base === gordonBase);
    });
    const tesouroRow = document.getElementById('gordonTesouroRow');
    const ifixRow     = document.getElementById('gordonIfixRow');
    if (tesouroRow) tesouroRow.style.display = gordonBase === 'tesouro' ? '' : 'none';
    if (ifixRow)     ifixRow.style.display    = gordonBase === 'ifix'    ? '' : 'none';

    const sel = document.getElementById('gBondPreset');
    const isCustom = sel && sel.value === 'custom';
    const customRow     = document.getElementById('gordonCustomRow');
    const customTypeRow = document.getElementById('gordonCustomTypeRow');
    const ipcaRow        = document.getElementById('gordonIpcaRow');
    if (customRow)     customRow.style.display     = isCustom ? '' : 'none';
    if (customTypeRow) customTypeRow.style.display = isCustom ? '' : 'none';

    let isReal;
    if (isCustom) {
        isReal = !!document.getElementById('gCustomIsReal')?.checked;
    } else {
        const opt = sel ? sel.options[sel.selectedIndex] : null;
        isReal = opt ? opt.dataset.type === 'real' : false;
    }
    if (ipcaRow) ipcaRow.style.display = (gordonBase === 'tesouro' && isReal) ? '' : 'none';
}

function gordonCompute() {
    const gVal = document.getElementById('gGVal');
    const pVal = document.getElementById('gPremiumVal');
    if (gVal) gVal.textContent = gordonG.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
    if (pVal) pVal.textContent = gordonPremium.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

    const dpa   = parseBR(document.getElementById('gDPA')?.value) || 0;
    const preco = parseBR(document.getElementById('gPreco')?.value);

    // D1 projetado
    const d1 = dpa * (1 + gordonG / 100);
    const d1Display = document.getElementById('gD1Display');
    if (d1Display) d1Display.textContent = dpa ? formatCurrency(d1) : 'R$ —';

    // Taxa base (líquida) conforme o benchmark escolhido
    let netBase = 0;
    const rateDetail = document.getElementById('gRateDetail');
    if (gordonBase === 'tesouro') {
        const preset = document.getElementById('gBondPreset');
        const isCustom = preset && preset.value === 'custom';
        const selectedOption = preset ? preset.options[preset.selectedIndex] : null;

        let rate, isReal;
        if (isCustom) {
            rate = parseBR(document.getElementById('gCustomRate')?.value) || 0;
            isReal = !!document.getElementById('gCustomIsReal')?.checked;
        } else {
            rate = selectedOption ? parseFloat(selectedOption.dataset.rate) : 0;
            isReal = selectedOption ? selectedOption.dataset.type === 'real' : false;
        }

        let nominalRate = rate;
        if (isReal) {
            // Efeito Fisher: taxas de títulos IPCA+ são REAIS (acima da inflação).
            // Para comparar com o crescimento nominal dos dividendos, convertemos
            // para o equivalente nominal antes de aplicar o desconto de IR.
            const ipca = parseBR(document.getElementById('gIpcaRate')?.value) || 0;
            nominalRate = ((1 + rate / 100) * (1 + ipca / 100) - 1) * 100;
        }

        netBase = nominalRate * (1 - 0.15); // IR de 15% sobre título público; FII é isento
        const rateDisplay = document.getElementById('gRateDisplay');
        if (rateDisplay) rateDisplay.textContent = formatPercent(netBase);

        if (rateDetail) {
            if (isReal) {
                rateDetail.style.display = '';
                rateDetail.innerHTML = `Taxa real: ${formatPercent(rate)} → nominal equivalente (Fisher): <strong>${formatPercent(nominalRate)}</strong> → líquida após IR de 15%: <strong>${formatPercent(netBase)}</strong>`;
            } else {
                rateDetail.style.display = '';
                rateDetail.innerHTML = `Taxa bruta: ${formatPercent(rate)} → líquida após IR de 15%: <strong>${formatPercent(netBase)}</strong>`;
            }
        }
    } else {
        netBase = parseBR(document.getElementById('gIfixRate')?.value) || 0;
        if (rateDetail) rateDetail.style.display = 'none';
    }

    // Atualiza o texto de dica conforme a base selecionada
    const hint = document.getElementById('gordonHint');
    if (hint) {
        hint.innerHTML = gordonBase === 'tesouro'
            ? 'Você está usando <strong>Renda Fixa (Tesouro)</strong> como taxa base. Para usar o IFIX, altere nas configurações <span class="gordon-hint-gear">⚙</span>.'
            : 'Você está usando o <strong>IFIX (ciclo imobiliário)</strong> como taxa base. Para voltar à Renda Fixa, altere nas configurações <span class="gordon-hint-gear">⚙</span>.';
    }

    // k = taxa base líquida + prêmio de risco
    const k = netBase + gordonPremium;
    const tetoBox    = document.getElementById('gTetoValue');
    const margemBox  = document.getElementById('gMargemBox');
    const margemVal  = document.getElementById('gMargemValue');

    if (!dpa || k <= gordonG) {
        if (tetoBox) tetoBox.textContent = '—';
        if (margemVal) margemVal.textContent = '—';
        if (margemBox) { margemBox.classList.remove('positive-box','negative-box'); }
        return;
    }

    const teto = d1 / ((k - gordonG) / 100);
    if (tetoBox) tetoBox.textContent = formatCurrency(teto);

    if (preco) {
        const margem = ((teto - preco) / preco) * 100;
        if (margemVal) margemVal.textContent = (margem >= 0 ? '+' : '') + margem.toFixed(2).replace('.', ',') + '%';
        if (margemBox) {
            margemBox.classList.toggle('positive-box', margem >= 0);
            margemBox.classList.toggle('negative-box', margem < 0);
        }
    } else {
        if (margemVal) margemVal.textContent = '—';
        if (margemBox) { margemBox.classList.remove('positive-box','negative-box'); }
    }
}

// Carregar estado salvo ao entrar na aba
const _origSwitchTab = typeof switchTab === 'function' ? switchTab : null;

// ============================================================
// TOOLTIP ENGINE (hover desktop + tap mobile)
// ============================================================

(function initTooltips() {
    let activeIcon = null;
    let box = null;

    function getBox() {
        if (!box) {
            box = document.createElement('div');
            box.className = 'calc-tooltip-box';
            document.body.appendChild(box);
        }
        return box;
    }

    function show(icon) {
        const text = icon.dataset.tooltip;
        if (!text) return;
        const b = getBox();
        b.textContent = text;
        b.classList.add('visible');

        const rect = icon.getBoundingClientRect();
        const bw = 220;
        let left = rect.left;
        let top = rect.bottom + 8;

        // Keep within viewport horizontally
        if (left + bw > window.innerWidth - 8) left = window.innerWidth - bw - 8;
        if (left < 8) left = 8;

        // If too close to bottom, flip upward
        if (top + 120 > window.innerHeight) top = rect.top - 8 - 120;

        b.style.left = left + 'px';
        b.style.top  = top  + 'px';
        activeIcon = icon;
    }

    function hide() {
        if (box) box.classList.remove('visible');
        activeIcon = null;
    }

    document.addEventListener('mouseover', e => {
        const icon = e.target.closest('.calc-tooltip-icon');
        if (icon) show(icon);
    });

    document.addEventListener('mouseout', e => {
        if (e.target.closest('.calc-tooltip-icon')) hide();
    });

    document.addEventListener('click', e => {
        const icon = e.target.closest('.calc-tooltip-icon');
        if (icon) {
            e.stopPropagation();
            if (activeIcon === icon) { hide(); return; }
            show(icon);
            return;
        }
        hide();
    });
})();
