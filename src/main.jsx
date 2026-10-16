import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, BriefcaseBusiness, CalendarDays,
  ChartNoAxesCombined, Check, ChevronDown, CircleDollarSign, ClipboardList,
  Download, HandCoins, LayoutDashboard, LogOut, MapPin, MoreHorizontal, PhoneCall,
  Monitor, Moon, Plus, Search, ShieldCheck, Sun, Trash2, Users, WalletCards, X
} from 'lucide-react';
import './style.css';

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000/api/v1' : `${window.location.origin}/api/v1`);
const nav = [
  ['Overview', LayoutDashboard], ['Customers', Users], ['Products', BriefcaseBusiness],
  ['Loans', HandCoins], ['Repayments', WalletCards], ['Collections', PhoneCall],
  ['Reports', ChartNoAxesCombined], ['Team', ShieldCheck]
];
const KES = cents => `KES ${(Number(cents || 0) / 100).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
const titleCase = text => (text || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

async function api(path, token, options = {}) {
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...options.headers };
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) { const detail=data?.detail; const message=Array.isArray(detail)?detail.map(item=>`${(item.loc||[]).slice(1).join('.')||'Request'}: ${item.msg}`).join('; '):typeof detail==='string'?detail:detail?JSON.stringify(detail):data?.message||`Request failed (${response.status})`; throw new Error(message); }
  return data;
}

function App() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('system');
  const [systemTheme, setSystemTheme] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light');
  const [page, setPage] = useState('Overview');
  const [data, setData] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loanChoices, setLoanChoices] = useState([]);
  const [overviewLoans, setOverviewLoans] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState('');
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState('');
  const [portfolioFile, setPortfolioFile] = useState(null);
  const [portfolioPreview, setPortfolioPreview] = useState(null);
  const [portfolioBusy, setPortfolioBusy] = useState(false);
  useEffect(() => { if (!token) { setPortfolioFile(null); setPortfolioPreview(null); setPortfolioBusy(false); setSuccess(''); } }, [token]);
  const isAdmin = user?.role === 'admin';
  const canManageTeam = ['admin', 'manager', 'branch_manager'].includes(user?.role);

  const loadPage = useCallback(async (target = page, query = '') => {
    if (!token) return;
    const routes = {
      Overview: '/reports/summary', Customers: `/customers?page=1&limit=100${query ? `&q=${encodeURIComponent(query)}` : ''}`,
      Products: '/products', Loans: '/loans?page=1&limit=100', Repayments: '/payments?page=1&limit=100',
      Collections: '/collections/queue', Reports: '/reports/summary', Team: '/users',
      'Customer profile': `/customers/${selectedCustomer}/profile`
    };
    try { setError(''); setData(await api(routes[target] || routes.Overview, token)); }
    catch (e) { setError(e.message); }
  }, [page, token, selectedCustomer]);

  useEffect(() => {
    if (!token) return;
    api('/auth/me', token).then(setUser).catch(() => { localStorage.removeItem('token'); setToken(''); setUser(null); });
  }, [token]);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const update = event => setSystemTheme(event.matches ? 'dark' : 'light');
    setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  useEffect(() => {
    const savedTheme = user?.id ? localStorage.getItem(`mwangazabiz-theme-${user.id}`) || 'system' : 'system';
    setTheme(['system', 'light', 'dark'].includes(savedTheme) ? savedTheme : 'system');
  }, [user?.id]);
  useEffect(() => {
    const effectiveTheme = theme === 'system' ? systemTheme : theme;
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.style.colorScheme = effectiveTheme;
  }, [theme, systemTheme]);
  useEffect(() => {
    if (!token) return;
    let lastActivity = Date.now();
    let timer;
    const expire = () => {
      localStorage.removeItem('token');
      setToken(''); setUser(null); setData(null); setPage('Overview');
      setError('You were signed out after 15 minutes of inactivity. Please sign in again.');
    };
    const schedule = () => {
      clearTimeout(timer);
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivity);
      timer = window.setTimeout(expire, Math.max(0, remaining));
    };
    const activity = () => {
      if (Date.now() - lastActivity >= IDLE_TIMEOUT_MS) { expire(); return; }
      lastActivity = Date.now();
      schedule();
    };
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel', 'mousemove'];
    events.forEach(name => window.addEventListener(name, activity, { passive: true }));
    const checkVisibility = () => { if (document.visibilityState === 'visible' && Date.now() - lastActivity >= IDLE_TIMEOUT_MS) expire(); };
    document.addEventListener('visibilitychange', checkVisibility);
    schedule();
    return () => {
      clearTimeout(timer);
      events.forEach(name => window.removeEventListener(name, activity));
      document.removeEventListener('visibilitychange', checkVisibility);
    };
  }, [token]);
  useEffect(() => {
    const expireRestoredPage = event => { if (event.persisted) { setToken(''); setUser(null); setData(null); } };
    window.addEventListener('pageshow', expireRestoredPage);
    return () => window.removeEventListener('pageshow', expireRestoredPage);
  }, []);
  useEffect(() => {
    if (!token) return;
    const expireOnBack = () => { localStorage.removeItem('token'); setToken(''); setUser(null); setData(null); };
    window.addEventListener('popstate', expireOnBack);
    return () => window.removeEventListener('popstate', expireOnBack);
  }, [token]);
  useEffect(() => { loadPage(page, search); }, [loadPage, page, search]);
  useEffect(() => {
    if (!token) return;
    if (['Loans', 'Overview'].includes(page)) api('/products', token).then(setProducts).catch(() => {});
    if (page === 'Overview') api('/loans?page=1&limit=5', token).then(r => setOverviewLoans(r.items || [])).catch(() => {});
    if (page === 'Loans') api('/customers?page=1&limit=100', token).then(r => setCustomers(r.items || [])).catch(() => {});
    if (page === 'Repayments') api('/loans?page=1&limit=100', token).then(r => setLoanChoices(r.items || [])).catch(() => {});
    if (['Collections', 'Overview'].includes(page) && ['admin', 'manager', 'branch_manager', 'collections_officer'].includes(user?.role))
      api('/collections/officers', token).then(setOfficers).catch(() => {});
  }, [page, token, user?.role]);

  async function signIn(event) {
    event.preventDefault(); setLoading(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await api('/auth/login', '', { method: 'POST', body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
      window.history.pushState({ mwAuthenticated: true }, '', window.location.href);
      setToken(result.access_token);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  async function submitModal(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    let path = '', body = { ...values }, headers = {};
    if (modal === 'Customers') { path = '/customers'; body.monthly_income_cents = Number(body.monthly_income_cents || 0); }
    if (modal === 'Products') {
      path = '/products'; body.min_cents = Number(body.min_cents); body.max_cents = Number(body.max_cents);
      body.annual_rate = Number(body.annual_rate); body.term_periods = Number(body.term_periods);
      body.processing_fee_cents = Number(body.processing_fee_cents || 0); body.penalty_daily_cents = Number(body.penalty_daily_cents || 0); body.grace_days = Number(body.grace_days || 0);
    }
    if (modal === 'Loans') { path = '/loans'; body.customer_id = Number(body.customer_id); body.product_id = Number(body.product_id); body.principal_cents = Number(body.principal_cents); }
    if (modal === 'Repayments') { path = '/payments'; body.loan_id = Number(body.loan_id); body.amount_cents = Number(body.amount_cents); headers['Idempotency-Key'] = crypto.randomUUID(); }
    if (modal === 'Team') { path = '/users'; }
    if (modal === 'Activity') { path = `/collections/${selectedLoan}/activities`; body.follow_up = body.follow_up || null; }
    if (modal === 'Interaction') { path = `/customers/${selectedCustomer}/interactions`; body.follow_up = body.follow_up || null; }
    if (modal === 'Assignment') { path = `/collections/${selectedLoan}/assign`; body.collector_id = Number(body.collector_id); }
    if (modal === 'Reversal') { path = `/payments/${selectedLoan}/reverse?reason=${encodeURIComponent(body.reason)}`; body = undefined; }
    try {
      await api(path, token, { method: modal === 'Reversal' ? 'POST' : 'POST', ...(body ? { body: JSON.stringify(body) } : {}), headers });
      setModal(''); setSelectedLoan(null); setError('');
      await loadPage(page, search);
      if (page === 'Collections' && selectedLoan && modal === 'Activity') setActivities(await api(`/collections/${selectedLoan}/activities`, token));
    } catch (e) { setError(e.message); }
  }

  async function reviewPayment(paymentId,status) {
    const note=status==='confirmed'?'Verified against the payment reference':window.prompt('Why is this repayment being rejected?');
    if (!note?.trim()) return;
    try { await api(`/payments/${paymentId}/review`, token, {method:'PATCH', body:JSON.stringify({status, note:note.trim()})}); await loadPage(page,search); }
    catch(e) { setError(e.message); }
  }
  async function updateLoanStatus(loanId, status) {
    try { await api(`/loans/${loanId}/status`, token, { method: 'PATCH', body: JSON.stringify({ status, note: 'Updated in loan workspace' }) }); await loadPage(page, search); }
    catch (e) { setError(e.message); }
  }
  async function exportLoans() {
    try {
      const response = await fetch(`${API}/reports/loans.csv`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.detail || 'Export failed'); }
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a');
      link.href = url; link.download = 'mwangazabiz-loans.csv'; link.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  }
  async function uploadPortfolio(file, commit = false) {
    if (!file) return;
    const form = new FormData(); form.append('file', file);
    setPortfolioBusy(true); setError(''); setSuccess('');
    try {
      const result = await api(`/imports/legacy-portfolio?commit=${commit}`, token, { method: 'POST', body: form });
      if (commit) {
        setPortfolioPreview(null); setPortfolioFile(null); await loadPage('Customers', search);
        setSuccess(`Imported ${result.imported} portfolio rows; created ${result.new_customers} customers; skipped ${result.skipped_phone_conflicts} phone conflicts.`);
      } else { setPortfolioFile(file); setPortfolioPreview(result); }
    } catch (e) { setError(e.message); }
    finally { setPortfolioBusy(false); }
  }
  async function changePassword(event) {
    event.preventDefault(); setError(''); const form = new FormData(event.currentTarget);
    if (form.get('new_password') !== form.get('confirm_password')) { setError('The new passwords do not match.'); return; }
    try { await api('/auth/change-password', token, { method: 'POST', body: JSON.stringify({ old_password: form.get('old_password'), new_password: form.get('new_password') }) }); setUser(current => ({ ...current, must_change_password: false })); }
    catch (e) { setError(e.message); }
  }
  async function uploadCustomerDocument(event, documentType) {
    const file = event.target.files?.[0]; if (!file || !selectedCustomer) return;
    const form = new FormData(); form.append('file', file);
    try { await api(`/customers/${selectedCustomer}/documents?document_type=${documentType}`, token, { method: 'POST', body: form }); await loadPage('Customer profile'); }
    catch (e) { setError(e.message); }
    event.target.value = '';
  }
  async function assignCollector(loanId, collectorId) {
    if (!collectorId) return;
    try { await api(`/collections/${loanId}/assign`, token, { method: 'POST', body: JSON.stringify({ collector_id: Number(collectorId) }) }); await loadPage(page, search); }
    catch (e) { setError(e.message); }
  }
  async function removeTeamMember(member) {
    if (!isAdmin || member.id === user.id || !member.active) return;
    if (!window.confirm(`Remove ${member.username}'s access? They will no longer be able to sign in. Their loan and audit history will be preserved.`)) return;
    try {
      await api(`/users/${member.id}`, token, { method: 'DELETE' });
      await loadPage('Team', search);
    } catch (e) { setError(e.message); }
  }
  async function openActivity(loanId) {
    setSelectedLoan(loanId); setModal('Activity'); setActivities([]);
    try { setActivities(await api(`/collections/${loanId}/activities`, token)); } catch (e) { setError(e.message); }
  }
  function logout() { localStorage.removeItem('token'); setToken(''); setUser(null); setData(null); setPage('Overview'); }
  function toggleTheme() {
    const nextTheme = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system';
    setTheme(nextTheme);
    if (user?.id) localStorage.setItem(`mwangazabiz-theme-${user.id}`, nextTheme);
  }
  function navigateTo(target) { setSearch(''); setSelectedCustomer(null); setPage(target); }

  if (!user) return <Login onSubmit={signIn} loading={loading} error={error} />;
  if (user.must_change_password) return <PasswordChange username={user.username} error={error} onSubmit={changePassword}/>;
  const rows = data?.items || [];
  const summary = data || {};
  const visibleNav = nav.filter(([name]) => name !== 'Team' || canManageTeam);
  const isNavActive = name => page === name || (page === 'Customer profile' && name === 'Customers');
  const actionName = { Customers: 'customer', Products: 'product', Loans: 'loan', Repayments: 'repayment', Team: 'team member' }[page];
  const ThemeIcon = theme === 'system' ? Monitor : theme === 'dark' ? Moon : Sun;
  const themeLabel = theme === 'system' ? 'Auto' : theme === 'dark' ? 'Dark' : 'Light';
  return <div className="shell">
    <div className="mobile-navigation">
      <div className="mobile-nav-top">
        <div className="mobile-brand"><div className="brand-mark">M</div><div><b>MWANGAZABIz</b><small>LENDING WORKSPACE</small></div></div>
        <div className="mobile-nav-actions">
          <span className="mobile-branch"><MapPin size={14}/><span>Nanyuki Branch</span></span>
          <button className="mobile-logout" onClick={logout} aria-label={`Log out ${user.username}`} title="Log out"><span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><LogOut size={15}/></button>
        </div>
      </div>
      <nav className="mobile-nav-links" aria-label="Primary navigation">
        {visibleNav.map(([name, Icon]) => <button key={name} className={`mobile-nav-item${isNavActive(name) ? ' selected' : ''}`} aria-current={isNavActive(name) ? 'page' : undefined} onClick={() => navigateTo(name)}><Icon size={16}/><span>{name}</span></button>)}
      </nav>
    </div>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">M</div><div><b>MWANGAZABIz</b><small>LENDING WORKSPACE</small></div></div>
      <div className="org"><div className="org-icon">N</div><div><b>Nanyuki Branch</b><small>Organization workspace</small></div><ChevronDown size={15}/></div>
      <div className="nav-label">OPERATIONS</div>
      <nav>{visibleNav.map(([name, Icon]) => <button key={name} className={isNavActive(name) ? 'selected' : ''} aria-current={isNavActive(name) ? 'page' : undefined} onClick={() => navigateTo(name)}><Icon size={18}/>{name}</button>)}</nav>
      <div className="side-bottom"><div className="help"><span className="help-dot">?</span><div><b>Need a hand?</b><small>Ask your administrator</small></div></div>
        <button className="profile" onClick={logout}><div className="avatar">{user.username.slice(0, 1).toUpperCase()}</div><div><b>{user.username}</b><small>{titleCase(user.role)}</small></div><LogOut size={16}/></button>
      </div>
    </aside>
    <main className="content">
      <header><div className="crumb">Workspace <span>/</span> {page}</div><div className="head-right"><span className="date"><CalendarDays size={15}/>{new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span><button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Theme: ${themeLabel}. Click to change.`} aria-pressed={theme === 'dark'} title={`Theme: ${themeLabel}. Click to change.`}><ThemeIcon size={16}/><span>{themeLabel}</span></button><div className="avatar small">{user.username.slice(0, 1).toUpperCase()}</div></div></header>
      <section className="page-head"><div><span className="eyebrow">{titleCase(user.role)} WORKSPACE</span><h1>{page === 'Overview' ? `Welcome back, ${user.username}` : page === 'Customer profile' ? (data?.customer?.full_name || 'Customer profile') : page}<span className="wave"> ✦</span></h1><p>{pageDescription(page, user.role)}</p></div>
        <div className="head-actions">{page === 'Customer profile' && <><button className="secondary" onClick={() => { setSelectedCustomer(null); setPage('Customers'); }}>Back to customers</button>{['admin','manager','branch_manager','loan_officer','collections_officer','accountant'].includes(user.role)&&<button className="primary" onClick={()=>setModal('Interaction')}><Plus size={17}/> Add interaction</button>}</>}{page === 'Customers' && isAdmin && <label className="secondary import-trigger">{portfolioBusy?'Reading workbook…':'Import Entire workbook'}<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={portfolioBusy} onChange={e=>{uploadPortfolio(e.target.files?.[0]);e.target.value='';}}/></label>}{['Customers','Products','Loans','Repayments','Team'].includes(page) && canCreate(page, user.role) && <button className="primary" onClick={() => setModal(page)}><Plus size={17}/> New {actionName}</button>}{['Reports','Loans','Customers','Repayments'].includes(page) && <button className="secondary" onClick={exportLoans}><Download size={16}/> Export CSV</button>}</div>
      </section>
      {error && <div className="notice"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
      {success && <div className="success-notice"><span>{success}</span><button onClick={() => setSuccess('')} aria-label="Dismiss success message">×</button></div>}
      {page === 'Customers' && portfolioPreview && <section className="panel import-review"><div><span className="eyebrow">WORKBOOK PREVIEW · {portfolioPreview.sheet}</span><h2>{portfolioPreview.rows_found} portfolio rows found</h2><p>{portfolioPreview.missing_phone} missing phones · {portfolioPreview.phone_conflicts||0} phone conflicts · {portfolioPreview.manual_balances} manually entered balances · {portfolioPreview.formula_balances} formula-derived balances · {portfolioPreview.missing_balance} missing balances</p>{portfolioPreview.warnings?.map(w=><p className="import-warning" key={w}>{w}</p>)}<p className="import-caution">This creates legacy opening snapshots only. It does not invent loan schedules, ledger entries, or payment history. Formula balances remain marked unverified.</p></div><div className="head-actions"><button className="secondary" onClick={()=>{setPortfolioPreview(null);setPortfolioFile(null);}}>Cancel</button><button className="primary" disabled={portfolioBusy||!portfolioFile} onClick={()=>uploadPortfolio(portfolioFile,true)}>{portfolioBusy?'Importing…':'Confirm import'}</button></div></section>}
      {page === 'Team' && <div className="team-note"><ShieldCheck size={19}/><div><b>{isAdmin ? 'Build your branch team' : 'Managers can build their branch team'}</b><span>{isAdmin ? 'Add managers, loan officers, and collections officers.' : 'Add loan officers and collections officers for your branch.'} New team members must change their temporary password at first sign-in.</span></div></div>}
      {page === 'Overview' && <Dashboard summary={summary} loans={overviewLoans} role={user.role} onPage={setPage} onStatus={updateLoanStatus}/>}
      {page === 'Customer profile' && data?.customer && <CustomerProfile profile={data} role={user.role} token={token} canUpload={canCreate('Customers',user.role)} onUpload={uploadCustomerDocument}/>}
      {page !== 'Overview' && page !== 'Customer profile' && <section className="panel list-panel">
        <div className="panel-head"><div><h2>{page === 'Team' ? 'People and access' : page}</h2><p>{pageDescription(page, user.role)}</p></div>
          {['Customers','Loans','Repayments'].includes(page) && <div className="table-tools"><div className="search"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${page.toLowerCase()}`}/></div></div>}
        </div>
        {page === 'Customers' && <CustomerTable rows={rows} onOpen={id => { setSelectedCustomer(id); setPage('Customer profile'); }}/ >}
        {page === 'Products' && <ProductTable rows={Array.isArray(data) ? data : []}/>}
        {page === 'Loans' && <LoanTable rows={rows} role={user.role} onStatus={updateLoanStatus}/>}
        {page === 'Repayments' && <PaymentTable rows={rows} canReview={['admin','manager','branch_manager'].includes(user.role)} reviewerId={user.id} canReverse={['admin','manager','branch_manager','accountant'].includes(user.role)} onReview={reviewPayment} onReverse={id => { setSelectedLoan(id); setModal('Reversal'); }}/ >}
        {page === 'Collections' && <CollectionTable rows={Array.isArray(data) ? data : []} officers={officers} user={user} onAssign={assignCollector} onActivity={openActivity}/ >}
        {page === 'Reports' && <Reports summary={summary}/>}
        {page === 'Team' && <TeamTable rows={Array.isArray(data) ? data : []} canDelete={isAdmin} currentUserId={user.id} onDelete={removeTeamMember}/>}
      </section>}
    </main>
    {modal && <RecordModal type={modal} isAdmin={isAdmin} products={products} customers={customers} loans={loanChoices} officers={officers} activities={modal==='Interaction'?(data?.interactions||[]):activities} selectedLoan={selectedLoan} onClose={() => { setModal(''); setSelectedLoan(null); }} onSubmit={submitModal}/>}
  </div>;
}

function pageDescription(page, role) {
  return ({ Overview: 'A live view of your branch portfolio and today’s priorities.', Customers: 'Customer profiles and KYC records from your organization.', 'Customer profile': 'A complete view of the customer relationship and account history.', Products: 'Configure pricing, repayment frequency, and product rules.', Loans: 'Review applications, appraise requests, and move approved loans forward.', Repayments: 'Post and reconcile customer payments.', Collections: 'Work arrears, assign follow-ups, and record every customer contact.', Reports: 'Portfolio performance based on posted transactions.', Team: ['manager','branch_manager'].includes(role) ? 'Build your branch team by adding loan and collections officers.' : 'Manage branch access for managers, loan officers, and collections officers.' })[page] || `${titleCase(role)} operations`;
}
function canCreate(page, role) {
  if (page === 'Team') return ['admin','manager','branch_manager'].includes(role);
  if (page === 'Products') return ['admin','manager','branch_manager'].includes(role);
  if (page === 'Customers') return ['admin','manager','branch_manager','loan_officer'].includes(role);
  if (page === 'Loans') return ['admin','manager','branch_manager','loan_officer'].includes(role);
  if (page === 'Repayments') return ['admin','manager','branch_manager','accountant','collections_officer'].includes(role);
  return false;
}

function Login({ onSubmit, loading, error }) {
  return <main className="login"><div className="login-card"><div className="brand-mark">M</div><span className="eyebrow">MWANGAZABIz FINANCE</span><h1>Good lending starts with clarity.</h1><p>Sign in to your lending operations workspace.</p><form onSubmit={onSubmit}><label>Username<input name="username" autoComplete="username" required placeholder="Your username"/></label><label>Password<input name="password" type="password" autoComplete="current-password" required placeholder="Your password"/></label>{error && <div className="error">{error}</div>}<button className="primary wide" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button></form></div><div className="login-art"><div className="sun"/><div className="art-copy"><span>GROW WITH PURPOSE</span><h2>Every business<br/>has a bright future.</h2><p>Simple, transparent credit for Kenyan entrepreneurs.</p></div><div className="art-hills"/></div></main>;
}

function PasswordChange({username,error,onSubmit}) {
  return <main className="login password-screen"><div className="login-card"><div className="brand-mark">M</div><span className="eyebrow">FIRST SIGN-IN SECURITY</span><h1>Set a new password</h1><p>Your administrator gave you a temporary password. Change it to continue to MWANGAZABIz.</p><form onSubmit={onSubmit}><label>Current temporary password<input name="old_password" type="password" autoComplete="current-password" required/></label><label>New password<input name="new_password" type="password" minLength="12" autoComplete="new-password" required/><small>Use at least 12 characters.</small></label><label>Confirm new password<input name="confirm_password" type="password" minLength="12" autoComplete="new-password" required/></label>{error&&<div className="error">{error}</div>}<button className="primary wide">Change password and continue</button></form><small>Signed in as {username}</small></div><div className="login-art"><div className="sun"/><div className="art-copy"><span>SECURE ACCESS</span><h2>Your work.<br/>Your account.</h2><p>Personalize your sign-in before viewing customer records.</p></div><div className="art-hills"/></div></main>;
}

function Dashboard({ summary, loans, role, onPage, onStatus }) {
  const collectedRate = `${(Number(summary.collection_rate || 0) * 100).toFixed(1)}%`;
  return <><div className="stats"><Metric label="Portfolio outstanding" value={KES(summary.portfolio_outstanding_cents)} change="Current ledger balance" icon={<CircleDollarSign/>} tint="green"/><Metric label="Total disbursed" value={KES(summary.disbursed_cents)} change={`${summary.active_loans || 0} active loans`} icon={<ArrowUpRight/>} tint="blue"/><Metric label="Total collected" value={KES(summary.collected_cents)} change={`${collectedRate} collection rate`} icon={<Check/>} tint="gold"/><Metric label="Portfolio at risk" value={KES(summary.par_cents)} change={`${summary.overdue_installments || 0} overdue installments`} icon={<Activity/>} tint="red"/></div>
    <div className="dashboard-grid"><section className="panel portfolio"><div className="panel-head"><div><h2>Portfolio snapshot</h2><p>Disbursed funds compared with collections</p></div><button className="text-btn" onClick={() => onPage('Reports')}>View reports <ArrowUpRight size={15}/></button></div><div className="compare-bars"><CompareBar label="Disbursed" cents={summary.disbursed_cents} max={Math.max(summary.disbursed_cents || 0, summary.collected_cents || 0, 1)} tint="primary-bar"/><CompareBar label="Collected" cents={summary.collected_cents} max={Math.max(summary.disbursed_cents || 0, summary.collected_cents || 0, 1)} tint="secondary-bar"/><div className="snapshot-note"><span>Outstanding</span><b>{KES(summary.portfolio_outstanding_cents)}</b><small>Balances derived from the loan ledger</small></div></div></section>
      <section className="panel quick"><div className="panel-head"><div><h2>Today’s priorities</h2><p>Open work queues</p></div></div><Action icon={<PhoneCall size={16}/>} title="Collections queue" subtitle={`${summary.overdue_installments || 0} overdue installments`} amount="Open" onClick={() => onPage('Collections')}/><Action icon={<HandCoins size={16}/>} title="Loan applications" subtitle="Review and advance applications" amount="Open" onClick={() => onPage('Loans')}/><Action icon={<WalletCards size={16}/>} title="Record repayment" subtitle={role==='manager'||role==='admin'?`${summary.pending_payments||0} awaiting manager review`:"Post a cash, M-Pesa, or bank payment"} amount="Open" onClick={() => onPage('Repayments')}/></section>
      <section className="panel recent"><div className="panel-head"><div><h2>Latest loans</h2><p>Applications and account status</p></div><button className="text-btn" onClick={() => onPage('Loans')}>All loans <ArrowUpRight size={15}/></button></div><LoanTable rows={loans.slice(0,5)} role={role} onStatus={onStatus}/></section>
      <section className="panel quick"><div className="panel-head"><div><h2>Portfolio health</h2><p>Based on recorded loan and payment activity</p></div></div><div className="health-number">{collectedRate}</div><div className="health-caption">Collected against total disbursements</div><div className="health-rule"><span style={{width: `${Math.min(100,Number(summary.collection_rate || 0)*100)}%`}}/></div><div className="health-detail"><span>{summary.overdue_installments || 0} past due</span><button className="text-btn" onClick={() => onPage('Collections')}>Work queue <ArrowUpRight size={14}/></button></div></section>
    </div></>;
}
function CompareBar({label,cents,max,tint}) { return <div className="compare-row"><div><span>{label}</span><b>{KES(cents)}</b></div><div className="compare-track"><i className={tint} style={{width:`${Math.max(cents ? 2 : 0,Number(cents || 0)/max*100)}%`}}/></div></div>; }
function Metric({label,value,change,icon,tint}) { return <div className="metric"><div className="metric-top"><span>{label}</span><i className={`metric-icon ${tint}`}>{icon}</i></div><b>{value}</b><small>{change}</small></div>; }
function Action({icon,title,subtitle,amount,onClick}) { return <button className="action action-button" onClick={onClick}><div className="action-icon">{icon}</div><div className="action-copy"><b>{title}</b><small>{subtitle}</small></div><span>{amount} <ArrowUpRight size={13}/></span></button>; }

function LoanTable({rows,onStatus,role}) {
  const allNext={application:['appraisal','rejected'],appraisal:['approved','rejected'],approved:['disbursed'],disbursed:['active'],active:['closed','written_off','restructured'],restructured:['active','closed','written_off']};
  const allowed=role==='loan_officer'?{application:['appraisal','rejected']}:role==='accountant'?{approved:['disbursed'],disbursed:['active']}:['admin','manager','branch_manager'].includes(role)?allNext:{};
  const next=allowed;
  return <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Product</th><th>Principal</th><th>Created</th><th>Status</th><th>Workflow</th></tr></thead><tbody>{rows.length ? rows.map((loan,i)=><tr key={loan.id}><td><div className="person"><div className={`avatar hue${i%4}`}>{(loan.customer_name||'C').slice(0,1)}</div><div><b>{loan.customer_name || `Customer #${loan.customer_id}`}</b><small>MW-{String(loan.id).padStart(5,'0')}</small></div></div></td><td>{loan.product_name || '—'}</td><td>{KES(loan.principal_cents)}</td><td>{loan.created_at ? new Date(loan.created_at).toLocaleDateString('en-KE') : '—'}</td><td><span className={`pill ${loan.status==='active'?'success-pill':loan.status==='rejected'?'danger-pill':'pending'}`}>{titleCase(loan.status)}</span></td><td><select className="row-action" value="" onChange={e=>e.target.value&&onStatus(loan.id,e.target.value)} disabled={!next[loan.status]?.length}><option value="">Next step</option>{(next[loan.status]||[]).map(status=><option key={status} value={status}>{titleCase(status)}</option>)}</select></td></tr>) : <Empty colSpan={6} text="No loans found. Create an application to get started."/>}</tbody></table></div>;
}
function CustomerTable({rows,onOpen}) { return <div className="table-wrap"><table><thead><tr><th>Customer</th><th>National ID</th><th>Phone</th><th>Location</th><th>Occupation</th><th>Monthly income</th><th/></tr></thead><tbody>{rows.length?rows.map(c=><tr key={c.id}><td><b>{c.full_name}</b></td><td>{c.national_id||'—'}</td><td>{c.phone||'—'}</td><td>{c.location}</td><td>{c.occupation||'—'}</td><td>{KES(c.monthly_income_cents)}</td><td><button className="row-text-action" onClick={()=>onOpen(c.id)}>View profile <ArrowUpRight size={13}/></button></td></tr>):<Empty colSpan={7} text="No customers match your search."/>}</tbody></table></div>; }
function CustomerProfile({profile,role,token,canUpload,onUpload}) {
  const [fileUrls,setFileUrls]=useState({}); const customer=profile.customer;
  useEffect(()=>{
    if(!['admin','manager','branch_manager','loan_officer'].includes(role)){setFileUrls({});return;}
    let alive=true;const created=[];
    Promise.all((profile.documents||[]).map(async doc=>{
      try{const response=await fetch(`${API}/customers/${customer.id}/documents/${doc.id}`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)return null;const url=URL.createObjectURL(await response.blob());created.push(url);return [doc.id,url];}catch{return null;}
    })).then(items=>{if(alive)setFileUrls(Object.fromEntries(items.filter(Boolean)));});
    return ()=>{alive=false;created.forEach(URL.revokeObjectURL);};
  },[profile.documents,customer.id,role,token]);
  const photo=(profile.documents||[]).find(d=>d.document_type==='profile_photo'&&fileUrls[d.id]);
  const canViewFiles=['admin','manager','branch_manager','loan_officer'].includes(role);
  return <div className="customer-profile">
    <section className="panel profile-hero"><div className="profile-identity">{photo?<img className="profile-photo" src={fileUrls[photo.id]} alt={`${customer.full_name} profile`}/>:<div className="profile-photo profile-initial">{customer.full_name.slice(0,1).toUpperCase()}</div>}<div><span className="eyebrow">CUSTOMER ACCOUNT · #{customer.id}</span><h2>{customer.full_name}</h2><p>{customer.location} · {customer.occupation||'Occupation not recorded'}</p></div></div><div className="profile-contact"><b>{customer.phone}</b><span>National ID · {customer.national_id}</span></div></section>
    <div className="profile-grid"><section className="panel profile-details"><div className="panel-head"><div><h2>Customer details</h2><p>KYC and contact information</p></div></div><div className="detail-grid"><Detail label="Phone" value={customer.phone}/><Detail label="National ID" value={customer.national_id}/><Detail label="Location" value={customer.location}/><Detail label="Occupation" value={customer.occupation||'—'}/><Detail label="Monthly income" value={KES(customer.monthly_income_cents)}/><Detail label="Next of kin" value={customer.next_of_kin||'—'}/><Detail label="Guarantors" value={customer.guarantors||'—'}/></div></section>
      <section className="panel profile-docs"><div className="panel-head"><div><h2>Identity and photos</h2><p>Private customer documents</p></div></div><div className="document-grid">{(profile.documents||[]).map(doc=><a className="document-item" key={doc.id} href={fileUrls[doc.id]||undefined} target="_blank" rel="noreferrer"><div className="document-preview">{fileUrls[doc.id]&&/\.(png|jpe?g)$/i.test(doc.filename)?<img src={fileUrls[doc.id]} alt={doc.document_type}/>:<ClipboardList size={22}/>}</div><b>{titleCase(doc.document_type)}</b><small>{doc.filename}</small></a>)}{!profile.documents?.length&&<div className="empty-doc">No files uploaded yet.</div>}</div>{canUpload&&<div className="upload-row"><label className="upload-button">Upload ID image<input type="file" accept="image/jpeg,image/png,application/pdf" onChange={e=>onUpload(e,'id_image')}/></label><label className="upload-button">Add profile photo<input type="file" accept="image/jpeg,image/png" onChange={e=>onUpload(e,'profile_photo')}/></label></div>}{!canViewFiles&&<div className="form-hint">Document previews are restricted to customer onboarding roles.</div>}</section></div>
    <section className="panel profile-section"><div className="panel-head"><div><h2>Loans and balances</h2><p>Current and historical loan accounts</p></div></div><div className="table-wrap"><table><thead><tr><th>Loan account</th><th>Product</th><th>Original amount</th><th>Current balance</th><th>Status</th><th>Opened</th></tr></thead><tbody>{profile.loans.length?profile.loans.map(l=><tr key={l.loan_id}><td>MW-{String(l.loan_id).padStart(5,'0')}</td><td>{l.product_name}</td><td>{KES(l.amount_cents)}</td><td><b>{KES(l.balance_cents)}</b></td><td><span className={`pill ${l.status==='active'?'success-pill':'pending'}`}>{titleCase(l.status)}</span></td><td>{new Date(l.created_at).toLocaleDateString('en-KE')}</td></tr>):<Empty colSpan={6} text="This customer has no loan accounts yet."/>}</tbody></table></div></section>
    {profile.legacy_loans?.length>0 && <section className="panel profile-section legacy-snapshots"><div className="panel-head"><div><h2>Imported portfolio snapshots</h2><p>Opening balances from the legacy Entire workbook; kept separate from verified live loan accounting</p></div></div><div className="table-wrap"><table><thead><tr><th>Source row</th><th>Original date</th><th>Amount disbursed</th><th>P+I</th><th>Workbook balance</th><th>Last payment</th><th>Balance status</th></tr></thead><tbody>{profile.legacy_loans.map(l=><tr key={l.id}><td>{l.source_sheet} · {l.source_row}</td><td>{l.source_date||'—'}</td><td>{l.principal_cents==null?'—':KES(l.principal_cents)}</td><td>{l.total_due_cents==null?'—':KES(l.total_due_cents)}</td><td>{l.balance_cents==null?'—':KES(l.balance_cents)}</td><td>{l.last_payment||'—'}</td><td>{l.balance_is_formula?<span className="pill pending" title={l.balance_formula}>Unverified formula</span>:<span className="pill success-pill">Workbook value</span>}</td></tr>)}</tbody></table></div></section>}
    <div className="profile-grid"><section className="panel profile-section"><div className="panel-head"><div><h2>Payments</h2><p>Recent payments across this customer’s loans</p></div></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Loan</th><th>Method</th><th>Reference</th><th>Amount</th><th>Status</th></tr></thead><tbody>{profile.payments.length?profile.payments.map(p=><tr key={p.id}><td>{new Date(p.created_at).toLocaleDateString('en-KE')}</td><td>MW-{String(p.loan_id).padStart(5,'0')}</td><td>{titleCase(p.method)}</td><td>{p.reference||'—'}</td><td>{KES(p.amount_cents)}</td><td>{p.reversed?'Reversed':titleCase(p.status||'confirmed')}</td></tr>):<Empty colSpan={6} text="No payments recorded."/>}</tbody></table></div></section>
      <section className="panel profile-section"><div className="panel-head"><div><h2>Customer interactions</h2><p>Calls, visits, messages, and follow-ups</p></div></div><div className="interaction-list">{profile.interactions.length?profile.interactions.map(i=><article className="interaction-item" key={i.id}><div className="interaction-icon"><Activity size={15}/></div><div><div className="interaction-title">{titleCase(i.interaction_type)} <span>· {titleCase(i.direction)}</span></div><p>{i.summary}</p><small>{i.username} · {new Date(i.created_at).toLocaleString('en-KE')}{i.follow_up?` · Follow up ${i.follow_up}`:''}</small></div></article>):<div className="empty-doc">No customer interactions recorded.</div>}</div></section></div>
  </div>;
}
function Detail({label,value}) { return <div className="detail-item"><span>{label}</span><b>{value||'—'}</b></div>; }
function ProductTable({rows}) { return <div className="table-wrap"><table><thead><tr><th>Product</th><th>Amount range</th><th>Interest</th><th>Method</th><th>Term</th><th>Frequency</th><th>Penalty / day</th></tr></thead><tbody>{rows.length?rows.map(p=><tr key={p.id}><td><b>{p.name}</b></td><td>{KES(p.min_cents)} – {KES(p.max_cents)}</td><td>{(Number(p.annual_rate)*100).toFixed(2)}% p.a.</td><td>{titleCase(p.interest_method)}</td><td>{p.term_periods} periods</td><td>{titleCase(p.frequency)}</td><td>{KES(p.penalty_daily_cents)}</td></tr>):<Empty colSpan={7} text="No loan products yet."/>}</tbody></table></div>; }
function PaymentTable({rows,onReverse,canReverse,canReview,reviewerId,onReview}) { return <div className="table-wrap"><table><thead><tr><th>Loan</th><th>Amount</th><th>Method</th><th>Reference</th><th>Received</th><th>Review status</th><th>Actions</th></tr></thead><tbody>{rows.length?rows.map(p=><tr key={p.id}><td>MW-{String(p.loan_id).padStart(5,'0')}</td><td>{KES(p.amount_cents)}</td><td>{titleCase(p.method)}</td><td>{p.reference||'—'}</td><td>{new Date(p.created_at).toLocaleDateString('en-KE')}</td><td><span className={`pill ${p.reversed?'danger-pill':p.status==='confirmed'?'success-pill':p.status==='rejected'?'danger-pill':'pending'}`}>{p.reversed?'Reversed':titleCase(p.status||'confirmed')}</span>{p.status==='pending'&&canReview&&p.created_by===reviewerId&&<small className="payment-note">Awaiting another manager</small>}{p.review_note&&<small className="payment-note">{p.review_note}</small>}</td><td className="payment-actions">{canReview&&p.status==='pending'&&p.created_by!==reviewerId&&<><button className="row-text-action" onClick={()=>onReview(p.id,'confirmed')}>Confirm</button><button className="row-text-action reject-action" onClick={()=>onReview(p.id,'rejected')}>Reject</button></>}{canReverse&&!p.reversed&&p.status==='confirmed'&&<button className="row-text-action" onClick={()=>onReverse(p.id)}>Reverse</button>}</td></tr>):<Empty colSpan={7} text="No repayments recorded yet."/>}</tbody></table></div>; }

function CollectionTable({rows,officers,user,onAssign,onActivity}) { return <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Loan</th><th>Due date</th><th>Days late</th><th>Ageing</th><th>Amount due</th><th>Assigned officer</th><th>Action</th></tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={`${r.loan_id}-${r.due_date}-${i}`}><td><b>{r.customer_name}</b></td><td>MW-{String(r.loan_id).padStart(5,'0')}</td><td>{r.due_date}</td><td>{r.days_past_due}</td><td><span className="pill danger-pill">{r.bucket}</span></td><td>{KES(r.amount_due_cents)}</td><td>{['admin','branch_manager'].includes(user.role)?<select className="row-action assign-select" value={r.collector_id||''} onChange={e=>onAssign(r.loan_id,e.target.value)}><option value="">Unassigned</option>{officers.map(o=><option key={o.id} value={o.id}>{o.username}</option>)}</select>:(r.collector_name||'Unassigned')}</td><td><button className="row-text-action" onClick={()=>onActivity(r.loan_id)}>Log contact</button></td></tr>):<Empty colSpan={8} text="No overdue installments in the queue."/>}</tbody></table></div>; }
function TeamTable({rows,canDelete,currentUserId,onDelete}) { return <div className="table-wrap"><table><thead><tr><th>Officer</th><th>Role</th><th>Branch</th><th>Account</th><th>Password setup</th><th>Added</th>{canDelete&&<th>Actions</th>}</tr></thead><tbody>{rows.length?rows.map((u,i)=><tr key={u.id}><td><div className="person"><div className={`avatar hue${i%4}`}>{u.username.slice(0,1).toUpperCase()}</div><b>{u.username}</b></div></td><td><span className="role-label">{titleCase(u.role)}</span></td><td>Nanyuki</td><td><span className={`pill ${u.active?'success-pill':'danger-pill'}`}>{u.active?'Active':'Disabled'}</span></td><td><span className={`pill ${u.must_change_password?'pending':'success-pill'}`}>{u.must_change_password?'Change required':'Complete'}</span></td><td>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-KE') : '—'}</td>{canDelete&&<td><button type="button" className="remove-member" onClick={()=>onDelete(u)} disabled={!u.active||u.id===currentUserId} title={u.id===currentUserId?'You cannot remove your own account':u.active?'Remove access':'Account already disabled'} aria-label={u.active?`Remove ${u.username} access`:`${u.username} account already disabled`}><Trash2 size={15}/><span>{u.active?'Remove':'Removed'}</span></button></td>}</tr>):<Empty colSpan={canDelete?7:6} text="No team members found."/>}</tbody></table></div>; }
function Reports({summary}) { const cards=[['Portfolio outstanding',summary.portfolio_outstanding_cents],['Total disbursed',summary.disbursed_cents],['Total collected',summary.collected_cents],['Portfolio at risk',summary.par_cents]]; return <div className="report-cards">{cards.map(([label,value])=><div className="report-card" key={label}><span>{label}</span><b>{KES(value)}</b></div>)}</div>; }
function Empty({colSpan,text}) { return <tr><td colSpan={colSpan} className="empty">{text}</td></tr>; }

function RecordModal({type,isAdmin,products,customers,loans,officers,activities,selectedLoan,onClose,onSubmit}) {
  const customerFields=[['full_name','Full name','text'],['national_id','National ID','text'],['phone','Phone (+254)','tel'],['location','Location','text'],['next_of_kin','Next of kin','text'],['guarantors','Guarantors','text'],['occupation','Occupation','text'],['monthly_income_cents','Monthly income (cents)','number']];
  const productFields=[['name','Product name','text'],['min_cents','Minimum (cents)','number'],['max_cents','Maximum (cents)','number'],['annual_rate','Annual interest rate (e.g. 0.18)','number'],['interest_method','Interest method','select:flat,reducing'],['term_periods','Number of installments','number'],['frequency','Frequency','select:daily,weekly,monthly'],['processing_fee_cents','Processing fee (cents)','number'],['penalty_daily_cents','Penalty per day (cents)','number'],['grace_days','Grace days','number']];
  let fields=type==='Customers'?customerFields:type==='Products'?productFields:type==='Loans'?[['customer_id','Customer','customer'],['product_id','Loan product','product'],['principal_cents','Principal (cents)','number']]:type==='Repayments'?[['loan_id','Loan account','loan'],['amount_cents','Amount (cents)','number'],['method','Payment method','select:cash,mpesa,bank'],['reference','Reference number','text']]:type==='Team'?[['username','Username','text'],['password','Temporary password (12+ characters)','password'],['role','Team role',isAdmin?'select:manager,loan_officer,collections_officer':'select:loan_officer,collections_officer']]:type==='Activity'?[['activity','Contact type','select:call,visit,promise_to_pay,note'],['notes','Contact notes','textarea'],['follow_up','Follow-up date','date']]:type==='Interaction'?[['interaction_type','Interaction type','select:call,visit,message,note'],['direction','Direction','select:inbound,outbound,internal'],['summary','Notes or message','textarea'],['follow_up','Follow-up date','date']]:type==='Assignment'?[['collector_id','Collections officer','officer']]:[['reason','Reason for reversal (required)','text']];
  const heading={Customers:'Register customer',Products:'Create loan product',Loans:'New loan application',Repayments:'Record repayment',Team:'Add team member',Activity:`Log collection contact · Loan ${selectedLoan}`,Assignment:'Assign collections officer',Reversal:`Reverse repayment · ${selectedLoan}`}[type];
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="modal" onSubmit={onSubmit}><div className="modal-head"><div><span className="eyebrow">MWANGAZABIz WORKSPACE</span><h2>{heading}</h2></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20}/></button></div><div className="modal-fields">{fields.map(([name,label,kind])=><label key={name} className={kind==='textarea'?'field-wide':''}>{label}{kind==='product'?<select name={name} required defaultValue=""><option value="" disabled>Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {KES(p.min_cents)}–{KES(p.max_cents)}</option>)}</select>:kind==='customer'?<select name={name} required defaultValue=""><option value="" disabled>Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.full_name} · {c.phone}</option>)}</select>:kind==='loan'?<select name={name} required defaultValue=""><option value="" disabled>Select loan</option>{loans.filter(l=>['active','disbursed','restructured'].includes(l.status)).map(l=><option key={l.id} value={l.id}>MW-{String(l.id).padStart(5,'0')} · {l.customer_name} · {KES(l.principal_cents)}</option>)}</select>:kind==='officer'?<select name={name} required defaultValue=""><option value="" disabled>Select officer</option>{officers.map(o=><option key={o.id} value={o.id}>{o.username}</option>)}</select>:kind.startsWith('select:')?<select name={name} required defaultValue=""><option value="" disabled>Select</option>{kind.slice(7).split(',').map(o=><option key={o} value={o}>{titleCase(o)}</option>)}</select>:kind==='textarea'?<textarea name={name} rows="3" required/>:<input name={name} type={kind} min={kind==='number'?0:undefined} step={name==='annual_rate'?'0.01':kind==='number'?'1':undefined} minLength={kind==='password'?12:undefined} required/>}</label>)}</div>{type==='Team'&&<div className="form-hint">{isAdmin ? 'Add a manager, loan officer, or collections officer to your organization.' : 'You can add loan officers and collections officers to your branch.'} New team members must change their temporary password before accessing customer or loan records.</div>}{type==='Repayments'&&<div className="form-hint">This repayment stays pending until a different manager verifies its reference and confirms it. Use cents for the amount.</div>}{['Activity','Interaction'].includes(type)&&<div className="activity-history"><b>Recent contact history</b>{activities?.length?activities.slice(0,4).map(a=><div className="history-row" key={a.id}><span>{titleCase(a.activity||a.interaction_type)} · {new Date(a.created_at).toLocaleDateString('en-KE')}</span><small>{a.notes||a.summary}{a.follow_up?` · Follow up ${a.follow_up}`:''}</small></div>):<small>No contact history yet.</small>}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary"><Check size={16}/> Save</button></div></form></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
