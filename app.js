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

// ===================== STORAGE HELPERS (Supabase-backed) =====================
// appDataCache guarda todos os dados do usuário logado em memória.
// loadData/saveData mantêm a MESMA assinatura de antes — o resto do app
// (todas as outras ~20 chamadas) não precisou mudar nada.
let appDataCache = null;
let currentUser = null;
let syncTimeout = null;

const KEY_TO_COLUMN = {
    byfinance_kraken: 'kraken',
    byfinance_proventos: 'proventos',
    byfinance_aportes: 'aportes',
    byfinance_ativos: 'ativos',
    byfinance_calc: 'calc'
};

function loadData(key, fallback) {
    const column = KEY_TO_COLUMN[key];
    if (appDataCache && column && appDataCache[column] !== undefined && appDataCache[column] !== null) {
        return appDataCache[column];
    }
    // Sem sessão carregada ainda (ou chave fora do mapeamento): usa o cache local como fallback
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
}

function saveData(key, data) {
    // Espelho local: mantém o app utilizável mesmo se a rede cair no meio do uso
    localStorage.setItem(key, JSON.stringify(data));

    const column = KEY_TO_COLUMN[key];
    if (appDataCache && column) {
        appDataCache[column] = data;
        scheduleCloudSync();
    }
}

function scheduleCloudSync() {
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(syncToCloud, 700);
}

async function syncToCloud() {
    if (!supabaseClient || !currentUser || !appDataCache) return;
    try {
        const { error } = await supabaseClient
            .from('dados_usuario')
            .update({
                kraken: appDataCache.kraken,
                proventos: appDataCache.proventos,
                aportes: appDataCache.aportes,
                ativos: appDataCache.ativos,
                calc: appDataCache.calc
            })
            .eq('user_id', currentUser.id);
        if (error) {
            console.error('Erro ao sincronizar com a nuvem:', error);
            showToast('Falha ao sincronizar — verifique sua conexão', 'error');
        }
    } catch (err) {
        console.error('Erro ao sincronizar com a nuvem:', err);
    }
}

// ===================== AUTENTICAÇÃO =====================
let isSignupMode = false;

function toggleAuthMode() {
    isSignupMode = !isSignupMode;
    document.getElementById('authConfirmWrap').style.display = isSignupMode ? 'block' : 'none';
    document.getElementById('authTitle').textContent = isSignupMode ? 'Criar sua conta' : 'Bem-vindo de volta';
    document.getElementById('authSubtitle').textContent = isSignupMode ? 'Comece a organizar seus investimentos' : 'Entre na sua conta para continuar';
    document.getElementById('authSubmitLabel').textContent = isSignupMode ? 'Criar conta' : 'Entrar';
    document.getElementById('authToggleQuestion').textContent = isSignupMode ? 'Já tem conta?' : 'Não tem conta?';
    document.getElementById('authToggleBtn').textContent = isSignupMode ? 'Entrar' : 'Criar agora';
    document.getElementById('authForgotBtn').style.visibility = isSignupMode ? 'hidden' : 'visible';
    document.getElementById('authError').style.display = 'none';
}

function showAuthError(msg) {
    const el = document.getElementById('authError');
    el.textContent = msg;
    el.style.display = 'block';
}

function traduzErroSupabase(msg) {
    if (!msg) return 'Ocorreu um erro. Tente novamente.';
    if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (msg.includes('already registered') || msg.includes('already been registered')) return 'Este e-mail já está cadastrado.';
    if (msg.includes('Password should be')) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (msg.includes('Unable to validate email')) return 'E-mail inválido.';
    return msg;
}

async function handleAuthSubmit() {
    if (!supabaseClient) {
        showAuthError('Supabase não configurado. Preencha o arquivo supabase-config.js com as chaves do seu projeto.');
        return;
    }

    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const btn = document.getElementById('authSubmitBtn');

    document.getElementById('authError').style.display = 'none';

    if (!email || !password) {
        showAuthError('Preencha e-mail e senha.');
        return;
    }
    if (isSignupMode) {
        const confirm = document.getElementById('authPasswordConfirm').value;
        if (password !== confirm) {
            showAuthError('As senhas não coincidem.');
            return;
        }
        if (password.length < 6) {
            showAuthError('A senha precisa ter pelo menos 6 caracteres.');
            return;
        }
    }

    btn.disabled = true;
    try {
        if (isSignupMode) {
            const { data, error } = await supabaseClient.auth.signUp({ email, password });
            if (error) throw error;
            if (data.session) {
                await onAuthSuccess(data.session.user);
            } else {
                showAuthError('Conta criada! Verifique seu e-mail para confirmar antes de entrar.');
            }
        } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            await onAuthSuccess(data.user);
        }
    } catch (err) {
        showAuthError(traduzErroSupabase(err.message));
    } finally {
        btn.disabled = false;
    }
}

async function onAuthSuccess(user) {
    currentUser = user;
    await fetchAndCacheUserData();
    enterAppFromAuth();
}

function enterAppFromAuth() {
    const authScreen = document.getElementById('authScreen');
    const introScreen = document.getElementById('introScreen');
    const dashboard = document.getElementById('dashboard');

    authScreen.classList.add('hidden');

    setTimeout(() => {
        // Mostra a intro
        initDashboardParticles('introParticles');
        introScreen.classList.add('active');

        // Depois de a animação toda rodar, some com a intro e revela o dashboard
        setTimeout(() => {
            introScreen.classList.add('exit');

            setTimeout(() => {
                introScreen.classList.remove('active', 'exit');

                dashboard.classList.add('active');
                document.body.classList.add('dashboard-active');
                initDashboardParticles('dashboardParticles');
                initDashboard();
            }, 600); // duração da animação de saída (introFadeOut)
        }, 2500); // tempo total que a intro fica visível antes de sair
    }, 350);
}

async function handleGoogleLogin() {
    if (!supabaseClient) {
        showAuthError('Supabase não configurado. Preencha o arquivo supabase-config.js com as chaves do seu projeto.');
        return;
    }
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) showAuthError(traduzErroSupabase(error.message));
}

function toggleAuthPasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
    btnEl.classList.toggle('active', input.type === 'text');
}

async function handleForgotPassword() {
    if (!supabaseClient) {
        showAuthError('Supabase não configurado.');
        return;
    }
    const email = document.getElementById('authEmail').value.trim();
    if (!email) {
        showAuthError('Digite seu e-mail no campo acima e clique em "Esqueceu?" de novo.');
        return;
    }
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
    });
    if (error) {
        showAuthError(traduzErroSupabase(error.message));
    } else {
        document.getElementById('authError').style.display = 'none';
        showToast('Enviamos um link de redefinição para seu e-mail');
    }
}

async function fetchAndCacheUserData() {
    const { data, error } = await supabaseClient
        .from('dados_usuario')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

    if (error) {
        console.error('Erro ao buscar dados do usuário:', error);
        showToast('Erro ao carregar seus dados da nuvem', 'error');
        appDataCache = { kraken: {}, proventos: {}, aportes: {}, ativos: [], calc: {} };
        return;
    }

    if (data) {
        appDataCache = data;
    } else {
        // Primeiro acesso: cria a linha do usuário com valores padrão
        appDataCache = { kraken: {}, proventos: {}, aportes: {}, ativos: [], calc: {} };
        const { error: insertError } = await supabaseClient
            .from('dados_usuario')
            .insert({ user_id: currentUser.id, ...appDataCache });
        if (insertError) console.error('Erro ao criar registro inicial:', insertError);
    }
}

function handleLogout() {
    showConfirmModal('Deseja realmente sair da sua conta?', async () => {
        await supabaseClient.auth.signOut();
        currentUser = null;
        appDataCache = null;
        location.reload();
    }, 'Sair');
}

async function initAuthGate() {
    if (!supabaseClient) {
        showAuthError('Configure o arquivo supabase-config.js com as chaves do seu projeto Supabase antes de usar o app (veja instruções no próprio arquivo).');
        return;
    }
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
        await onAuthSuccess(session.user);
    }
    // Sem sessão: a tela de autenticação já é a visível por padrão.

    // O Supabase processa o token de acesso que vem no #hash (login com
    // Google ou confirmação de e-mail), mas costuma deixar um "#" solto
    // na barra de endereço depois. Limpa isso sempre, com ou sem sessão.
    if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
    }
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
// (entrada no app agora é feita via enterAppFromAuth(), disparada pelo login)

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
    if (tabName === 'ativos') { ensureAtivosDbLoaded(); renderAtivos(); }
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
function initDashboardParticles(containerId = 'dashboardParticles') {
    const container = document.getElementById(containerId);
    if (!container || container.children.length > 0) return; // avoid re-spawn

    // No dashboard, o container cobre a tela inteira e tem um card central,
    // então as partículas ficam concentradas nas bordas pra não "sujar" o card.
    // Na tela de login, o container #authParticles já é só o painel esquerdo
    // (sem card no meio), então espalha por toda a largura dele.
    const fullSpread = containerId === 'authParticles' || containerId === 'introParticles';

    // O dashboard fica aberto por muito mais tempo que intro/auth (que somem
    // em segundos), então usamos menos partículas ali pra reduzir o custo de
    // animação contínua ao longo da sessão inteira.
    const particleCount = containerId === 'dashboardParticles' ? 12 : 20;

    for (let i = 0; i < particleCount; i++) {
        const p = document.createElement('div');
        p.className = 'd-particle';

        const side = fullSpread
            ? Math.random() * 100
            : (i < 10 ? Math.random() * 16 : 84 + Math.random() * 16);
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

    // Summary stats
    updateProventosSummary(data);

    // Tabelas: Histórico Mensal (patrimônio) + Histórico de Proventos (dividendos)
    renderHistoricoMensalTable(data);
    renderHistoricoProventosTable(data);

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

    const ganhoCapR = sb - va;
    const ganhoCapPct = va > 0 ? (ganhoCapR / va) * 100 : 0;

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

function setHistoricoTab(tab) {
    document.querySelectorAll('.historico-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.getElementById('historicoMensalPanel').style.display = tab === 'mensal' ? '' : 'none';
    document.getElementById('historicoProventosPanel').style.display = tab === 'proventos' ? '' : 'none';
}

// Filtro compartilhado pelas duas tabelas de histórico (Mensal e Proventos)
function getFilteredHistoricoKeys(data) {
    let keys = Object.keys(data).sort();
    const now = new Date();

    if (currentProventosFilter !== 'all') {
        if (currentProventosFilter === '6m') {
            const cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1);
            keys = keys.filter(k => new Date(data[k].year, data[k].month, 1) >= cutoff);
        } else if (currentProventosFilter === '12m') {
            const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);
            keys = keys.filter(k => new Date(data[k].year, data[k].month, 1) >= cutoff);
        } else {
            // year filter e.g. "2025"
            keys = keys.filter(k => String(data[k].year) === currentProventosFilter);
        }
    }
    return keys;
}

// ── Histórico Mensal: evolução patrimonial (aplicado, saldo, ganho, delta) ──
// O tooltip das células do grid Ano x Mês precisa "escapar" do container
// com scroll horizontal (overflow-x cria um contexto que também recorta
// o eixo vertical — é assim que o CSS funciona). Por isso ele é montado
// direto no <body>, posicionado via JS com as coordenadas reais da célula.
function toggleChangelog() {
    const overlay = document.getElementById('changelogOverlay');
    overlay.style.display = overlay.style.display === 'none' ? 'flex' : 'none';
}

function showFloatingTooltip(cellEl) {
    const source = cellEl.querySelector('.year-grid-tooltip');
    if (!source) return;

    let tip = document.getElementById('floatingTooltip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'floatingTooltip';
        tip.className = 'floating-tooltip';
        document.body.appendChild(tip);
    }
    tip.innerHTML = source.innerHTML;
    tip.style.display = 'block';

    const rect = cellEl.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();

    let top = rect.top - tipRect.height - 8;
    if (top < 8) top = rect.bottom + 8; // sem espaço em cima: mostra embaixo da célula

    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));

    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
}

function hideFloatingTooltip() {
    const tip = document.getElementById('floatingTooltip');
    if (tip) tip.style.display = 'none';
}

// Valor compacto pras células do grid (espaço é curto: 12 meses lado a lado)
function formatCompactCurrency(value) {
    if (value === null || value === undefined || isNaN(value) || value === 0) return '—';
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1000) {
        return sign + 'R$ ' + (abs / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'k';
    }
    return sign + 'R$ ' + Math.round(abs).toLocaleString('pt-BR');
}

// Agrupa as chaves filtradas por ano, mapeando mês (0-11) → dado do mês
function groupHistoricoByYear(keys, data) {
    const byYear = {};
    keys.forEach(k => {
        const d = data[k];
        if (!byYear[d.year]) byYear[d.year] = {};
        byYear[d.year][d.month] = { key: k, ...d };
    });
    const years = Object.keys(byYear).map(Number).sort((a, b) => b - a); // mais recente primeiro
    return { byYear, years };
}

// Monta o cabeçalho Ano | Jan | Fev | ... | Dez (compartilhado pelas duas tabelas)
function renderYearGridHead(theadRowId) {
    const row = document.getElementById(theadRowId);
    row.innerHTML = '<th>Ano</th>' + MONTH_NAMES_SHORT.map(m => `<th>${m}</th>`).join('');
}

// ── Histórico Mensal: uma linha por ano, um mês por coluna ──────
// Cada célula mostra o Saldo Bruto (valor principal) + a variação vs.
// mês anterior; passar o mouse revela o detalhe completo (aplicado,
// ganho de capital, delta). Clicar edita o mês; o "×" no canto exclui.
function renderHistoricoMensalTable(data) {
    const keys = getFilteredHistoricoKeys(data);
    const tbody = document.getElementById('historicoMensalTableBody');
    const emptyState = document.getElementById('historicoMensalEmpty');

    if (keys.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = '';
        return;
    }
    emptyState.style.display = 'none';
    renderYearGridHead('historicoMensalYearGridHead');

    const allKeysSorted = Object.keys(data).sort(); // pra achar o mês anterior corretamente
    const { byYear, years } = groupHistoricoByYear(keys, data);

    tbody.innerHTML = years.map(year => {
        const cells = MONTH_NAMES_SHORT.map((_, month) => {
            const entry = byYear[year][month];
            if (!entry) return '<td class="year-grid-cell empty">—</td>';

            const va = entry.valorAplicado || 0;
            const sb = entry.saldoBruto || 0;
            const ganhoR = sb - va;
            const ganhoPct = va > 0 ? (ganhoR / va) * 100 : 0;

            const idxGlobal = allKeysSorted.indexOf(entry.key);
            let deltaR = null, deltaPct = null;
            if (idxGlobal > 0) {
                const prevSB = data[allKeysSorted[idxGlobal - 1]]?.saldoBruto || 0;
                deltaR = sb - prevSB;
                deltaPct = prevSB > 0 ? (deltaR / prevSB) * 100 : null;
            }
            const deltaClass = deltaR === null ? '' : (deltaR >= 0 ? 'positive' : 'negative');
            const deltaLabel = deltaR === null ? '—' : (deltaR >= 0 ? '↑ ' : '↓ ') + formatPercent(Math.abs(deltaPct ?? 0));

            return `<td class="year-grid-cell has-data" onclick="editProventosMonth(${year}, ${month})" onmouseenter="showFloatingTooltip(this)" onmouseleave="hideFloatingTooltip()">
                <span class="year-grid-value">${formatCompactCurrency(sb)}</span>
                <span class="year-grid-sub ${deltaClass}">${deltaLabel}</span>
                <div class="year-grid-tooltip">
                    <div class="provento-tooltip-row"><span>Val. Aplicado</span><strong>${formatCurrency(va)}</strong></div>
                    <div class="provento-tooltip-row"><span>Saldo Bruto</span><strong>${formatCurrency(sb)}</strong></div>
                    <div class="provento-tooltip-row"><span>Ganho Capital</span><strong>${formatCurrency(ganhoR)} (${formatPercent(ganhoPct)})</strong></div>
                    <div class="provento-tooltip-row"><span>Δ vs. mês anterior</span><strong>${deltaR === null ? '—' : formatCurrency(deltaR)}</strong></div>
                </div>
                <button class="year-grid-delete" onclick="event.stopPropagation(); deleteProventosMonth('${entry.key}')" title="Excluir">×</button>
            </td>`;
        }).join('');

        return `<tr><td class="year-grid-year">${year}</td>${cells}</tr>`;
    }).join('');
}

// ── Histórico de Proventos: mesma ideia, célula mostra o total de
//    dividendos, e o hover revela a divisão entre FIIs e Ações + Yield.
//    Somente leitura (editar/excluir ficam no Histórico Mensal). ──────
function renderHistoricoProventosTable(data) {
    const keys = getFilteredHistoricoKeys(data);
    const tbody = document.getElementById('historicoProventosTableBody');
    const emptyState = document.getElementById('historicoProventosEmpty');

    if (keys.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = '';
        return;
    }
    emptyState.style.display = 'none';
    renderYearGridHead('historicoProventosYearGridHead');

    const { byYear, years } = groupHistoricoByYear(keys, data);

    tbody.innerHTML = years.map(year => {
        const cells = MONTH_NAMES_SHORT.map((_, month) => {
            const entry = byYear[year][month];
            if (!entry) return '<td class="year-grid-cell empty">—</td>';

            const div = entry.dividendos || 0;
            const divFII = entry.dividendosFII || 0;
            const valFII = entry.valorFII || 0;
            const divAcoes = Math.max(div - divFII, 0);
            const yieldFII = valFII > 0 ? (divFII / valFII) * 100 : 0;

            return `<td class="year-grid-cell" onmouseenter="showFloatingTooltip(this)" onmouseleave="hideFloatingTooltip()">
                <span class="year-grid-value">${formatCurrency(div)}</span>
                <div class="year-grid-tooltip">
                    <div class="provento-tooltip-row"><span>🏢 FIIs</span><strong>${formatCurrency(divFII)}</strong></div>
                    <div class="provento-tooltip-row"><span>📈 Ações</span><strong>${formatCurrency(divAcoes)}</strong></div>
                    <div class="provento-tooltip-row"><span>Yield FIIs</span><strong>${formatPercent(yieldFII)}</strong></div>
                </div>
            </td>`;
        }).join('');

        return `<tr><td class="year-grid-year">${year}</td>${cells}</tr>`;
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
// BAR CHART — Evolução dos Proventos
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
// TAB: ATIVOS
// ============================================================
let currentAtivosFilter = 'all'; // 'all' | 'FII' | 'Ação'
let editingAtivoId = null;

// ===================== LAZY LOAD: BASE DE ATIVOS (B3) =====================
// ativos-db.js (~440 tickers, ~50KB) só é usado aqui na aba Ativos pra
// classificar um ticker digitado. Em vez de carregar sempre no início do
// app (junto com Kraken/Proventos/Aporte, que não precisam disso), ele é
// buscado sob demanda na primeira vez que a aba Ativos é aberta.
let ativosDbPromise = null;
function ensureAtivosDbLoaded() {
    if (typeof classificarAtivo === 'function') return Promise.resolve();
    if (ativosDbPromise) return ativosDbPromise;
    ativosDbPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'ativos-db.min.js';
        script.onload = () => resolve();
        script.onerror = () => {
            ativosDbPromise = null; // permite tentar de novo numa próxima chamada
            reject(new Error('Falha ao carregar ativos-db.js'));
        };
        document.body.appendChild(script);
    });
    return ativosDbPromise;
}

function getAtivosData() {
    return loadData('byfinance_ativos', []);
}

function saveAtivosData(list) {
    saveData('byfinance_ativos', list);
}

// Monta um resumo de exibição a partir do retorno de classificarAtivo()
function classificarParaExibicao(ticker) {
    const c = classificarAtivo(ticker);

    if (c.tipo === 'FII') {
        const segmentoLabel = c.subtipo && c.segmento ? `${c.subtipo} — ${c.segmento}` : (c.subtipo || c.segmento || null);
        return { tipo: 'FII', segmentoLabel, fonte: c.confianca };
    }
    if (c.tipo === 'Ação') {
        return { tipo: 'Ação', segmentoLabel: c.segmento || null, fonte: c.confianca };
    }
    if (c.tipo === 'BDR') {
        return { tipo: 'BDR', segmentoLabel: c.segmento || null, fonte: c.confianca };
    }
    // Não identificado: melhor esforço, deixa tudo pro preenchimento manual
    return { tipo: null, segmentoLabel: null, fonte: 'desconhecido' };
}

function handleAtivoTickerInput(input) {
    input.value = input.value.toUpperCase();
    const ticker = input.value.trim();
    const preview = document.getElementById('ativoPreview');
    const manualWrap = document.getElementById('ativoManualWrap');

    if (!ticker) {
        preview.style.display = 'none';
        manualWrap.style.display = 'none';
        return;
    }

    // Base ainda não chegou (raro: usuário digitou rápido demais) — espera
    // carregar e refaz a chamada com o valor atual do campo.
    if (typeof classificarAtivo !== 'function') {
        ensureAtivosDbLoaded().then(() => handleAtivoTickerInput(input));
        return;
    }

    const result = classificarParaExibicao(ticker);
    preview.style.display = 'flex';

    const badgeEl = document.getElementById('ativoPreviewTipo');
    const segmentoEl = document.getElementById('ativoPreviewSegmento');
    const fonteEl = document.getElementById('ativoPreviewFonte');

    if (result.tipo) {
        badgeEl.textContent = result.tipo;
        badgeEl.className = 'badge ' + (result.tipo === 'FII' ? 'badge-green' : 'badge-blue');
    } else {
        badgeEl.textContent = 'A definir';
        badgeEl.className = 'badge';
    }

    segmentoEl.textContent = result.segmentoLabel || 'Segmento não identificado';

    const fonteLabels = {
        base_de_dados: '✓ Base B3',
        heuristica: 'Tipo estimado pelo ticker',
        desconhecido: 'Não identificado'
    };
    fonteEl.textContent = fonteLabels[result.fonte] || '';

    // Mostra o campo manual sempre que não temos segmento vindo da base de dados
    manualWrap.style.display = result.segmentoLabel ? 'none' : 'block';
}

function saveAtivo() {
    if (typeof classificarAtivo !== 'function') {
        ensureAtivosDbLoaded().then(saveAtivo);
        return;
    }

    const tickerInput = document.getElementById('ativoTicker');
    const ticker = tickerInput.value.trim().toUpperCase();

    if (!ticker) {
        showToast('Informe o ticker do ativo', 'error');
        return;
    }

    const quantidadeRaw = document.getElementById('ativoQuantidade').value.trim();
    const quantidade = quantidadeRaw ? parseInt(quantidadeRaw, 10) : null;

    const valorInvestidoRaw = document.getElementById('ativoValorInvestido').value.trim();
    const valorInvestido = valorInvestidoRaw ? parseCurrencyInput(valorInvestidoRaw) : null;

    const result = classificarParaExibicao(ticker);
    const manualSegmento = document.getElementById('ativoSegmentoManual').value.trim();
    const tipoFinal = result.tipo || 'Ação'; // melhor esforço quando não identificado
    const segmentoFinal = result.segmentoLabel || manualSegmento || 'Não informado';

    const list = getAtivosData();

    if (editingAtivoId) {
        const idx = list.findIndex(a => a.id === editingAtivoId);
        if (idx !== -1) {
            list[idx] = { ...list[idx], ticker, tipo: tipoFinal, segmento: segmentoFinal, quantidade, valorInvestido };
        }
        editingAtivoId = null;
        document.getElementById('ativoSaveBtn').innerHTML =
            '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8L6.5 11.5L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Adicionar Ativo';
        showToast('Ativo atualizado!');
    } else {
        list.push({
            id: Date.now().toString(),
            ticker,
            tipo: tipoFinal,
            segmento: segmentoFinal,
            quantidade,
            valorInvestido,
            dataAdicao: new Date().toISOString()
        });
        showToast('Ativo adicionado!');
    }

    saveAtivosData(list);

    tickerInput.value = '';
    document.getElementById('ativoQuantidade').value = '';
    document.getElementById('ativoValorInvestido').value = '';
    document.getElementById('ativoSegmentoManual').value = '';
    document.getElementById('ativoPreview').style.display = 'none';
    document.getElementById('ativoManualWrap').style.display = 'none';

    renderAtivos();
}

function editAtivo(id) {
    const list = getAtivosData();
    const ativo = list.find(a => a.id === id);
    if (!ativo) return;

    editingAtivoId = id;
    document.getElementById('ativoTicker').value = ativo.ticker;
    document.getElementById('ativoQuantidade').value = ativo.quantidade ?? '';
    document.getElementById('ativoValorInvestido').value = ativo.valorInvestido ?? '';
    document.getElementById('ativoSegmentoManual').value = '';
    document.getElementById('ativoSaveBtn').innerHTML =
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8L6.5 11.5L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Atualizar Ativo';

    handleAtivoTickerInput(document.getElementById('ativoTicker'));
    document.querySelector('#tab-ativos .card-highlight').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteAtivo(id) {
    showConfirmModal('Deseja realmente excluir este ativo?', () => {
        const list = getAtivosData().filter(a => a.id !== id);
        saveAtivosData(list);
        renderAtivos();
        showToast('Ativo removido', 'info');
    });
}

function setAtivosFilter(filter) {
    currentAtivosFilter = filter;
    renderAtivos();
}

function renderAtivosFilters() {
    const container = document.getElementById('ativosFilters');
    if (!container) return;

    const filters = [
        { id: 'all', label: 'Todos' },
        { id: 'Ação', label: 'Ações' },
        { id: 'FII', label: 'FIIs' }
    ];

    container.innerHTML = filters.map(f =>
        `<button class="filter-chip${currentAtivosFilter === f.id ? ' active' : ''}"
            onclick="setAtivosFilter('${f.id}')">${f.label}</button>`
    ).join('');
}

function renderAtivos() {
    renderAtivosFilters();

    const list = getAtivosData();
    const filtered = currentAtivosFilter === 'all'
        ? list
        : list.filter(a => a.tipo === currentAtivosFilter);

    const tbody = document.getElementById('ativosTableBody');
    const emptyState = document.getElementById('ativosEmpty');

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = '';
        return;
    }
    emptyState.style.display = 'none';

    tbody.innerHTML = filtered
        .slice()
        .sort((a, b) => a.ticker.localeCompare(b.ticker))
        .map(a => `<tr>
            <td><strong>${a.ticker}</strong></td>
            <td><span class="badge ${a.tipo === 'FII' ? 'badge-green' : 'badge-blue'}">${a.tipo}</span></td>
            <td>${a.segmento}</td>
            <td>${a.quantidade ?? '—'}</td>
            <td>${a.valorInvestido ? formatCurrency(a.valorInvestido) : '—'}</td>
            <td>
                <button class="btn-icon btn-edit" onclick="editAtivo('${a.id}')" title="Editar">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 10.5V12H3.5L10.2 5.3L8.7 3.8L2 10.5ZM11.8 3.7C12 3.5 12 3.2 11.8 3L11 2.2C10.8 2 10.5 2 10.3 2.2L9.5 3L11 4.5L11.8 3.7Z" fill="currentColor"/></svg>
                </button>
                <button class="btn-icon btn-delete" onclick="deleteAtivo('${a.id}')" title="Excluir">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4H11L10.3 12H3.7L3 4ZM5 2H9M2 4H12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                </button>
            </td>
        </tr>`).join('');

    renderDiversificacao();
}

// ============================================================
// DIVERSIFICAÇÃO DA CARTEIRA (por Tipo e por Segmento)
// ============================================================
let currentDiversificacaoTab = 'tipo';

function setDiversificacaoTab(tab) {
    currentDiversificacaoTab = tab;
    document.querySelectorAll('#diversificacaoTabs .historico-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.getElementById('diversificacaoTipoPanel').style.display = tab === 'tipo' ? '' : 'none';
    document.getElementById('diversificacaoSegmentoPanel').style.display = tab === 'segmento' ? '' : 'none';
}

function renderDiversificacao() {
    const list = getAtivosData();
    const comValor = list.filter(a => a.valorInvestido && a.valorInvestido > 0);
    const semValor = list.length - comValor.length;

    const emptyState = document.getElementById('diversificacaoEmpty');
    const tipoPanel = document.getElementById('diversificacaoTipoPanel');
    const segmentoPanel = document.getElementById('diversificacaoSegmentoPanel');
    const hint = document.getElementById('diversificacaoHint');

    if (comValor.length === 0) {
        emptyState.style.display = '';
        tipoPanel.style.display = 'none';
        segmentoPanel.style.display = 'none';
        hint.textContent = '';
        return;
    }
    emptyState.style.display = 'none';
    setDiversificacaoTab(currentDiversificacaoTab);

    hint.textContent = semValor > 0
        ? `Calculado com base no Valor Investido de ${comValor.length} ativo${comValor.length > 1 ? 's' : ''} (${semValor} sem valor informado não entram na conta).`
        : `Calculado com base no Valor Investido dos seus ${comValor.length} ativo${comValor.length > 1 ? 's' : ''}.`;

    // Agrupa por Tipo (Ação/FII/BDR)
    const porTipo = {};
    comValor.forEach(a => { porTipo[a.tipo] = (porTipo[a.tipo] || 0) + a.valorInvestido; });
    renderDonutWithLegend('diversificacaoTipoChart', 'diversificacaoTipoLegend', porTipo);

    // Agrupa por Segmento
    const porSegmento = {};
    comValor.forEach(a => { porSegmento[a.segmento] = (porSegmento[a.segmento] || 0) + a.valorInvestido; });
    renderDonutWithLegend('diversificacaoSegmentoChart', 'diversificacaoSegmentoLegend', porSegmento);
}

// Donut + legenda lado a lado — mesmo estilo de desenho do gráfico de
// Distribuição de Proventos (canvas puro, sem biblioteca), só que aqui a
// legenda fica ao lado (scrollável) em vez de embaixo, pra economizar
// espaço vertical quando há muitas categorias (ex: vários segmentos).
function renderDonutWithLegend(canvasId, legendId, grupos) {
    const canvas = document.getElementById(canvasId);
    const legendEl = document.getElementById(legendId);
    const ctx = canvas.getContext('2d');

    const entries = Object.entries(grupos).sort((a, b) => b[1] - a[1]); // maior primeiro
    const labels = entries.map(e => e[0]);
    const values = entries.map(e => e[1]);
    const total = values.reduce((a, b) => a + b, 0);

    const dpr = window.devicePixelRatio || 1;
    const size = 200;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 8;
    const innerRadius = radius * 0.6;

    let startAngle = -Math.PI / 2;
    const sliceData = []; // guarda os ângulos de cada fatia, pra detectar o hover depois
    values.forEach((val, i) => {
        const sliceAngle = (val / total) * Math.PI * 2;
        const endAngle = startAngle + sliceAngle;
        const color = PIE_COLORS[i % PIE_COLORS.length];

        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(startAngle) * innerRadius, cy + Math.sin(startAngle) * innerRadius);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#161616';
        ctx.lineWidth = 2;
        ctx.stroke();

        sliceData.push({
            label: labels[i],
            value: val,
            pct: total > 0 ? (val / total) * 100 : 0,
            startAngle,
            endAngle
        });

        startAngle = endAngle;
    });

    const textMuted = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#6B6058';
    const textPrimary = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#F0EBE3';
    ctx.fillStyle = textMuted;
    ctx.font = `500 11px Inter`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Total', cx, cy - 10);

    ctx.fillStyle = textPrimary;
    ctx.font = `700 13px Inter`;
    ctx.fillText(formatCompactCurrency(total), cx, cy + 10);

    // Legenda (rolável, um item por categoria, ordenado do maior pro menor)
    legendEl.innerHTML = labels.map((label, i) => {
        const color = PIE_COLORS[i % PIE_COLORS.length];
        const pct = total > 0 ? (values[i] / total) * 100 : 0;
        return `<div class="diversificacao-legend-item">
            <span class="chart-legend-dot" style="background:${color}"></span>
            <span class="diversificacao-legend-label" title="${label}">${label}</span>
            <span class="diversificacao-legend-pct">${formatPercent(pct)}</span>
        </div>`;
    }).join('');

    // Hover no donut: detecta a fatia sob o cursor (ângulo + distância do
    // centro) e mostra o mesmo tooltip flutuante usado no grid de histórico.
    canvas.onmousemove = function (e) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const dx = mx - cx;
        const dy = my - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < innerRadius || dist > radius) {
            hideFloatingTooltip();
            canvas.style.cursor = 'default';
            return;
        }

        let angle = Math.atan2(dy, dx);
        if (angle < -Math.PI / 2) angle += Math.PI * 2;
        const hit = sliceData.find(s => angle >= s.startAngle && angle < s.endAngle);

        if (hit) {
            canvas.style.cursor = 'pointer';
            showChartTooltipAt(e.clientX, e.clientY, `
                <div class="provento-tooltip-row"><span>${hit.label}</span><strong>${formatPercent(hit.pct)}</strong></div>
                <div class="provento-tooltip-row"><span>Valor</span><strong>${formatCurrency(hit.value)}</strong></div>
            `);
        } else {
            hideFloatingTooltip();
        }
    };
    canvas.onmouseleave = function () {
        hideFloatingTooltip();
        canvas.style.cursor = 'default';
    };
}

// Mesma ideia do showFloatingTooltip, mas posicionado nas coordenadas do
// mouse (usado pelo hover do donut) em vez das coordenadas de uma célula.
function showChartTooltipAt(clientX, clientY, html) {
    let tip = document.getElementById('floatingTooltip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'floatingTooltip';
        tip.className = 'floating-tooltip';
        document.body.appendChild(tip);
    }
    tip.innerHTML = html;
    tip.style.display = 'block';

    const tipRect = tip.getBoundingClientRect();
    let left = clientX + 14;
    let top = clientY + 14;
    left = Math.min(left, window.innerWidth - tipRect.width - 8);
    top = Math.min(top, window.innerHeight - tipRect.height - 8);

    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
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

// Fechar o menu mobile ao clicar fora do hamburguer e do dropdown
document.addEventListener('click', function(event) {
    const hamburger = document.getElementById('menuHamburger');
    const dropdown = document.getElementById('menuDropdown');

    if (hamburger && dropdown) {
        if (!hamburger.contains(event.target) && !dropdown.contains(event.target)) {
            hamburger.classList.remove('active');
            dropdown.classList.remove('open');
        }
    }
});

function closeMenu() {
    const hamburger = document.getElementById('menuHamburger');
    const dropdown = document.getElementById('menuDropdown');
    if (hamburger) hamburger.classList.remove('active');
    if (dropdown) dropdown.classList.remove('open');
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
    initAuthGate();
    initTheme();
    initDashboardParticles('authParticles');
    initMouseGlow();

    ['authEmail', 'authPassword', 'authPasswordConfirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleAuthSubmit(); });
    });

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
    // Re-render chart with new theme colors (só se o dashboard já estiver montado)
    if (document.getElementById('proventosChart')) {
        const data = getProventosData();
        renderProventosPieChart(data);
    }
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

function showConfirmModal(message, onConfirm, confirmLabel = 'Excluir') {
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
                    <button class="btn-danger" id="confirmModalOk"></button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
    }
    document.getElementById('confirmModalMsg').textContent = message;
    // O texto do botão é sempre definido aqui, a cada chamada — nunca fica
    // "herdado" de um uso anterior (ex.: logout definindo "Sair" e uma
    // exclusão posterior aparecendo com o texto errado).
    document.getElementById('confirmModalOk').textContent = confirmLabel;
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
