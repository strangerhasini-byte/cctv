import { type FormEvent, type ReactNode, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertCircle, AlertTriangle, ArrowUpRight, BarChart3, Bell, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, Clock3, CloudUpload, Command, Eye, FileText, Film,
  Fingerprint, HelpCircle, LayoutDashboard, ListFilter, LoaderCircle, MapPin, Menu, MoreHorizontal,
  Pause, Play, Plus, Radio, Search, Send, Settings, Shield, ShieldCheck, SlidersHorizontal,
  Sparkles, Upload, Video as VideoIcon, X,
} from 'lucide-react';
import {
  useAskAboutEvidence, useCreateAlert, useCreateInvestigation, useCreateReport, useCreateVideo,
  useGetAlerts, useGetEvents, useGetInvestigations, useGetReports, useGetVideos,
  useGetVisionDashboard, useRequestUploadUrl, useReviewEvent, useSearchEvidence, useUpdateAlertStatus,
  getGetAlertsQueryKey, getGetEventsQueryKey, getGetInvestigationsQueryKey, getGetReportsQueryKey,
  getGetVideosQueryKey, getGetVisionDashboardQueryKey,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth, type AuthUser } from '@workspace/replit-auth-web';
import './session.css';
import NotFound from '@/pages/not-found';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  AlertRule as AlertRuleData,
  Dashboard as DashboardData,
  Event as EventData,
  Investigation as InvestigationData,
  Report as ReportData,
  Video as VideoData,
} from '@workspace/api-client-react';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1 } } });
const navGroups = [
  { title: 'Workspace', items: [
    { path: '/', label: 'Overview', icon: LayoutDashboard },
    { path: '/videos', label: 'Video library', icon: Film },
    { path: '/upload', label: 'Secure upload', icon: CloudUpload },
    { path: '/live', label: 'Live cameras', icon: Radio },
  ] },
  { title: 'Review', items: [
    { path: '/investigations', label: 'Investigations', icon: Shield },
    { path: '/events', label: 'Event review', icon: Eye },
    { path: '/people', label: 'Anonymous tracks', icon: Fingerprint },
    { path: '/search', label: 'Evidence search', icon: Search },
    { path: '/ask-ai', label: 'Ask evidence', icon: Sparkles },
  ] },
  { title: 'Operations', items: [
    { path: '/alerts', label: 'Alert rules', icon: Bell },
    { path: '/reports', label: 'Reports', icon: FileText },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/settings', label: 'Settings', icon: Settings },
  ] },
];
const titles: Record<string, [string, string]> = {
  '/': ['Operational overview', 'A clear view of recorded activity and work in review.'],
  '/videos': ['Video library', 'Find a recording, then review its timestamped evidence.'],
  '/upload': ['Secure upload', 'Store source footage privately; automated video analysis is not connected yet.'],
  '/live': ['Camera status', 'A status view of configured camera feeds. No live footage is shown here.'],
  '/investigations': ['Investigations', 'Collect related events into a reviewable case.'],
  '/events': ['Event review', 'Review machine-flagged moments against their source evidence.'],
  '/people': ['Anonymous tracks', 'Review aggregate track counts. No identity matching is performed.'],
  '/search': ['Evidence search', 'Search descriptions in indexed event evidence.'],
  '/ask-ai': ['Ask about evidence', 'Matches questions to stored event descriptions; it does not interpret video.'],
  '/alerts': ['Alert rules', 'Manage rule definitions; live alert evaluation is not connected yet.'],
  '/reports': ['Reports', 'Generate a concise report from indexed footage evidence.'],
  '/analytics': ['Analytics', 'A measured view of indexed activity and review confidence.'],
  '/settings': ['Workspace settings', 'Review workspace guidance and data-handling expectations.'],
};

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Shell({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const dash = useGetVisionDashboard<DashboardData>();
  const videos = useGetVideos<VideoData[]>();
  const events = useGetEvents<EventData[]>();
  const investigations = useGetInvestigations<InvestigationData[]>();
  const alerts = useGetAlerts<AlertRuleData[]>();
  const reports = useGetReports<ReportData[]>();
  const activeTitle = titles[location] ?? titles['/'];
  const operatorName = user.firstName || user.lastName || user.email?.split('@')[0] || 'Operator';
  const initials = `${user.firstName?.[0] ?? user.email?.[0] ?? 'O'}${user.lastName?.[0] ?? ''}`.toUpperCase();
  return <div className="app-frame">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <Link href="/" className="brand" data-testid="link-brand">
        <span className="brand-mark"><ShieldCheck size={21} strokeWidth={2.1} /></span>
        <span><b>visionguard</b><small>OPERATIONS / 01</small></span>
      </Link>
      <div className="workspace-switch"><span className="workspace-glyph">V</span><span><b>VisionGuard workspace</b><small>Security review</small></span><ChevronDown size={15} /></div>
      <nav aria-label="Main navigation">
        {navGroups.map(group => <div className="nav-group" key={group.title}>
          <p className="nav-caption">{group.title}</p>
          {group.items.map(item => {
            const Icon = item.icon; const selected = location === item.path;
            return <Link key={item.path} href={item.path} onClick={() => setMobileNav(false)} className={`nav-link ${selected ? 'nav-active' : ''}`} aria-current={selected ? 'page' : undefined} data-testid={`link-nav-${item.path.slice(1) || 'overview'}`}>
              <Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>
              {item.path === '/alerts' && (alerts.data?.filter(a => a.status === 'active').length ?? 0) > 0 && <i className="nav-count">{alerts.data?.filter(a => a.status === 'active').length}</i>}
            </Link>;
          })}
        </div>)}
      </nav>
      <div className="sidebar-foot">
        <div className="security-note"><LockMark /><span><b>Private by design</b><small>Uploads are time-limited</small></span></div>
        <div className="operator"><span className="operator-avatar">{initials}</span><span><b>{operatorName}</b><small>{user.email || 'Workspace member'}</small></span><button className="sign-out-button" onClick={onLogout} data-testid="button-sign-out">Sign out</button></div>
      </div>
    </aside>
    {mobileNav && <button aria-label="Close navigation" className="mobile-scrim" onClick={() => setMobileNav(false)} data-testid="button-close-navigation" />}
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)} data-testid="button-open-navigation"><Menu size={19} /></button>
        <div className="crumb"><span>VisionGuard</span><ChevronRight size={14} /><b>{activeTitle[0]}</b></div>
        <div className="top-actions"><div className="connection"><span /> Review workspace</div><Link href="/alerts" className="icon-button top-bell" aria-label="Alert rules" data-testid="link-alerts-top"><Bell size={18} /></Link><span className="top-avatar">OP</span></div>
      </header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> SECURITY REVIEW WORKSPACE</div><h1>{activeTitle[0]}</h1><p>{activeTitle[1]}</p></div>
          <div className="heading-meta"><span className="live-indicator" /><span>Workspace active</span><span className="mono">{new Date().toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}</span></div>
        </div>
        <Switch>
          <Route path="/" component={() => <DashboardPage query={dash} hasSampleData={videos.data?.some(video => video.source === 'demo') ?? false} />} />
          <Route path="/videos" component={() => <VideosPage query={videos} events={events.data ?? []} />} />
          <Route path="/upload" component={() => <UploadPage />} />
          <Route path="/live" component={() => <LivePage query={dash} />} />
          <Route path="/investigations" component={() => <InvestigationsPage query={investigations} events={events.data ?? []} />} />
          <Route path="/events" component={() => <EventsPage query={events} />} />
          <Route path="/people" component={() => <PeoplePage dash={dash} />} />
          <Route path="/search" component={() => <SearchPage videos={videos.data ?? []} />} />
          <Route path="/ask-ai" component={() => <AskPage videos={videos.data ?? []} />} />
          <Route path="/alerts" component={() => <AlertsPage query={alerts} />} />
          <Route path="/reports" component={() => <ReportsPage query={reports} videos={videos.data ?? []} />} />
          <Route path="/analytics" component={() => <AnalyticsPage dash={dash} />} />
          <Route path="/settings" component={() => <SettingsPage />} />
          <Route component={NotFound} />
        </Switch>
        <footer className="page-footer"><span>VisionGuard AI <b>·</b> Review with evidence, not assumptions.</span><span>Timestamped records are the source of truth.</span></footer>
      </div>
    </main>
  </div>;
}
function LockMark() { return <span className="lock-mark"><Shield size={16} /></span>; }

function PageError({ retry, text = 'The workspace could not load this information.' }: { retry: () => void; text?: string }) {
  return <div className="state-box state-error" role="alert"><AlertCircle size={19} /><div><b>Unable to load data</b><p>{text}</p></div><button className="button button-secondary button-small" onClick={retry} data-testid="button-retry">Retry</button></div>;
}
function Skeleton({ count = 3 }: { count?: number }) { return <div className="skeleton-stack" aria-label="Loading data">{Array.from({ length: count }, (_, i) => <div className="skeleton-row" key={i}><i /><span /><span /></div>)}</div>; }
function EmptyState({ title, body, icon: Icon = CircleHelp, action }: { title: string; body: string; icon?: typeof Eye; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={21} /></span><b>{title}</b><p>{body}</p>{action}</div>;
}
function SectionTitle({ label, trailing }: { label: string; trailing?: ReactNode }) { return <div className="section-title"><h2>{label}</h2>{trailing}</div>; }
function ButtonLink({ to, children, icon: Icon = ChevronRight }: { to: string; children: ReactNode; icon?: typeof ChevronRight }) { return <Link className="text-link" href={to}>{children}<Icon size={15} /></Link>; }
function Severity({ value }: { value?: string }) { return <span className={`severity sev-${(value ?? 'info').toLowerCase()}`}><i />{value ?? 'Unrated'}</span>; }
function StatusBadge({ value }: { value?: string }) { return <span className={`status-badge status-${(value ?? 'unknown').toLowerCase()}`}>{(value ?? 'Unknown').replaceAll('_', ' ')}</span>; }
function formatTime(seconds: number) { const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60); return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
function formatDate(value?: string) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function formatSize(bytes: number) { if (!bytes) return '—'; return bytes > 1_000_000_000 ? `${(bytes / 1_000_000_000).toFixed(1)} GB` : `${(bytes / 1_000_000).toFixed(0)} MB`; }
function getVideoMime(file: File) {
  const supported = new Set(['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm']);
  if (supported.has(file.type.toLowerCase())) return file.type.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase();
  const byExtension: Record<string, string> = { mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska', webm: 'video/webm' };
  return extension ? byExtension[extension] : undefined;
}

function DashboardPage({ query, hasSampleData }: { query: UseQueryResult<DashboardData, Error>; hasSampleData: boolean }) {
  const d = query.data;
  return <div className="page-stack fade-up">
    {query.isLoading && <Skeleton count={5} />}{query.isError && <PageError retry={() => query.refetch()} />}
    {d && <>
      {hasSampleData && <div className="demo-banner" role="note"><AlertTriangle size={17} /><span><b>Sample workspace records</b><small>These example findings are not generated from your footage. New uploads are stored privately, but automated video analysis is not connected.</small></span></div>}
      <div className="overview-strip">
        <div className="overview-intro"><span className="intro-kicker"><Activity size={14} /> REVIEW SIGNAL</span><strong>Evidence in focus</strong><p>Recorded activity, surfaced for human review.</p></div>
        <Metric value={d.importantClips} label="Clips to review" meta={`${d.unusualEvents} unusual events`} accent />
        <Metric value={d.totalEvents} label="Indexed events" meta={`${d.videosAnalyzed} recordings`} />
        <Metric value={`${Math.round(d.confidence * 100)}%`} label="Mean confidence" meta="Model estimate · not verification" />
      </div>
      <div className="dashboard-grid">
        <section className="panel events-panel"><SectionTitle label="Recent findings" trailing={<ButtonLink to="/events">All findings</ButtonLink>} />
          {d.recentEvents.length ? <div className="event-list">{d.recentEvents.slice(0, 6).map(e => <article className="event-row" key={e.id} data-testid={`row-dashboard-event-${e.id}`}>
            <span className={`event-mark mark-${e.severity}`}><Activity size={16} /></span><div className="event-copy"><div><b>{e.eventType}</b><Severity value={e.severity} /></div><p>{e.description}</p><small><span>{e.videoName}</span><span className="mono">{formatTime(e.timestampSeconds)}</span><span>{e.location}</span></small></div><StatusBadge value={e.reviewStatus} />
          </article>)}</div> : <EmptyState title="No findings yet" body="When indexed evidence is available, recent findings will appear here." icon={Eye} />}</section>
        <section className="panel camera-panel"><SectionTitle label="Camera status" trailing={<ButtonLink to="/live">View all</ButtonLink>} />
          <div className="camera-summary"><span className="online-dot" /><b>{d.cameras.filter(c => c.status === 'online').length}</b><span>online</span><i /> <span>{d.cameras.length} configured</span></div>
          {d.cameras.length ? <div className="camera-list">{d.cameras.slice(0, 5).map((camera, i) => <div className="camera-row" key={`${camera.name}-${i}`}><span className={`camera-state camera-${camera.status}`} /><div><b>{camera.name}</b><small>{camera.location}</small></div><span className={`activity-tag activity-${camera.activity}`}>{camera.activity}</span></div>)}</div> : <EmptyState title="No camera status" body="Camera status is not available yet." icon={Radio} />}
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel signal-panel"><SectionTitle label="Activity, indexed" trailing={<span className="chart-legend"><i />Event volume</span>} />
          {d.activity.length ? <ActivityChart points={d.activity.map(v => v.value)} labels={d.activity.map(v => v.time)} /> : <EmptyState title="No activity series" body="Activity will appear when data is indexed." icon={BarChart3} />}
        </section>
        <section className="panel quick-panel"><SectionTitle label="Continue review" /><p className="panel-subtitle">Move from a signal to a human-reviewed record.</p><div className="quick-links"><ButtonLink to="/events" icon={ArrowUpRight}>Review flagged moments</ButtonLink><ButtonLink to="/investigations" icon={ArrowUpRight}>Open an investigation</ButtonLink><ButtonLink to="/search" icon={ArrowUpRight}>Search recorded evidence</ButtonLink></div>
          <div className="guardrail"><ShieldCheck size={17} /><span><b>Human review stays in control</b><small>Model confidence is a sorting aid, not proof.</small></span></div>
        </section>
      </div>
    </>}
  </div>;
}
function Metric({ value, label, meta, accent }: { value: ReactNode; label: string; meta: string; accent?: boolean }) { return <div className={`metric ${accent ? 'metric-accent' : ''}`}><span>{label}</span><strong>{value}</strong><small>{meta}</small></div>; }
function ActivityChart({ points, labels }: { points: number[]; labels: string[] }) {
  const max = Math.max(1, ...points);
  return <div className="activity-chart" role="img" aria-label="Event volume across indexed time periods">
    <div className="chart-y"><span>{max}</span><span>{Math.round(max / 2)}</span><span>0</span></div>
    <div className="chart-bars">{points.map((p, i) => <div className="chart-column" key={`${labels[i]}-${i}`} title={`${labels[i]}: ${p}`}><div className="chart-bar" style={{ height: `${Math.max(5, p / max * 100)}%` }} /><span>{labels[i]}</span></div>)}</div>
  </div>;
}

function VideosPage({ query, events }: { query: UseQueryResult<VideoData[], Error>; events: EventData[] }) {
  const [filter, setFilter] = useState(''); const [status, setStatus] = useState('all'); const [selected, setSelected] = useState<string | null>(null);
  const filtered = (query.data ?? []).filter(v => `${v.name} ${v.camera} ${v.location}`.toLowerCase().includes(filter.toLowerCase()) && (status === 'all' || v.status === status));
  const current = filtered.find(v => v.id === selected) ?? (selected ? query.data?.find(v => v.id === selected) : undefined);
  return <div className="page-stack fade-up">
    <div className="toolbar"><label className="search-field"><Search size={17} /><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search name, camera or location" aria-label="Search videos" data-testid="input-video-search" /><kbd>/</kbd></label><label className="select-wrap"><ListFilter size={15} /><select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status" data-testid="select-video-status"><option value="all">All statuses</option><option value="analyzed">Analyzed</option><option value="processing">Processing</option><option value="attention">Needs attention</option></select></label><Link href="/upload" className="button button-primary" data-testid="link-upload-video"><Plus size={16} /> Add video</Link></div>
    {query.isLoading && <Skeleton count={5} />}{query.isError && <PageError retry={() => query.refetch()} />}
    {query.data && <div className={`video-layout ${current ? 'video-layout-selected' : ''}`}>
      <section className="panel video-table-panel"><SectionTitle label={`${filtered.length} recordings`} trailing={<span className="table-note">Sorted by recent upload</span>} />
        {filtered.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Recording</th><th>Status</th><th>Duration</th><th>Findings</th><th>Risk</th><th /></tr></thead><tbody>{filtered.map(v => <tr key={v.id} className={current?.id === v.id ? 'selected-row' : ''}><td><button className="recording-cell" onClick={() => setSelected(v.id)} data-testid={`button-select-video-${v.id}`}><span className="recording-thumb"><VideoIcon size={18} /></span><span><b>{v.name}</b><small>{v.camera} · {v.location}</small>{v.source === 'demo' && <i className="sample-label">SAMPLE ANALYSIS</i>}</span></button></td><td><StatusBadge value={v.status} /></td><td className="mono">{formatTime(v.durationSeconds)}</td><td className="mono">{v.eventCount}</td><td><Severity value={v.riskLevel} /></td><td><button className="row-chevron" onClick={() => setSelected(v.id)} aria-label={`Review ${v.name}`} data-testid={`button-open-video-${v.id}`}><ChevronRight size={17} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="No matching recordings" body={query.data.length ? 'Try a different search or status filter.' : 'Upload a recording to start building an evidence review.'} icon={Film} action={!query.data.length && <Link className="button button-primary button-small" href="/upload"><Upload size={15} /> Upload footage</Link>} />}
      </section>
      {current && <VideoDetail video={current} events={events.filter(e => e.videoId === current.id)} onClose={() => setSelected(null)} />}
    </div>}
  </div>;
}
function VideoDetail({ video, events, onClose }: { video: VideoData; events: EventData[]; onClose: () => void }) {
  const player = useRef<HTMLVideoElement>(null);
  function seekTo(seconds: number) {
    if (!player.current || !video.objectPath) return;
    player.current.currentTime = seconds;
    void player.current.play().catch(() => undefined);
  }
  return <aside className="panel video-detail"><div className="detail-head"><span className="eyebrow">RECORDING DETAIL</span><button className="icon-button" onClick={onClose} aria-label="Close video details" data-testid="button-close-video-detail"><X size={17} /></button></div>{video.objectPath ? <video ref={player} className="source-player" controls preload="metadata" src={`/api/storage${video.objectPath}`} aria-label={`Source footage: ${video.name}`} /> : <div className="video-visual"><span className="visual-crosshair" /><span className="visual-time mono">REC / {formatDate(video.uploadedAt)}</span><Film size={30} /><small>Sample record · source footage unavailable</small></div>}<h3>{video.name}</h3><p className="detail-location"><MapPin size={14} />{video.camera} · {video.location}</p><div className="detail-metrics"><div><small>Duration</small><b>{formatTime(video.durationSeconds)}</b></div><div><small>Resolution</small><b>{video.resolution}</b></div><div><small>File size</small><b>{formatSize(video.fileSizeBytes)}</b></div></div><p className="detail-summary">{video.summary || 'No summary supplied.'}</p><div className="detail-disclaimer">Review status: <StatusBadge value={video.status} /> <span>{video.source === 'demo' ? 'Sample analysis' : 'Uploaded source'}</span></div><SectionTitle label={`Indexed moments · ${events.length}`} /><div className="detail-events">{events.slice(0, 5).map(e => <button type="button" className="detail-event" key={e.id} onClick={() => seekTo(e.timestampSeconds)} disabled={!video.objectPath} aria-label={`Jump to ${formatTime(e.timestampSeconds)}: ${e.eventType}`}><span className="mono">{formatTime(e.timestampSeconds)}</span><b>{e.eventType}</b><Severity value={e.severity} /></button>)}{!events.length && <p className="muted">No timestamped events are associated with this recording.</p>}</div></aside>;
}

function UploadPage() {
  const [file, setFile] = useState<File | null>(null); const [camera, setCamera] = useState(''); const [location, setLocation] = useState(''); const [phase, setPhase] = useState(''); const [error, setError] = useState('');
  const requestUrl = useRequestUploadUrl(); const createVideo = useCreateVideo(); const client = useQueryClient();
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!file || !camera.trim() || !location.trim()) return;
    const contentType = getVideoMime(file);
    if (!contentType) { setError('Choose an MP4, MOV, AVI, MKV, or WebM video.'); return; }
    if (file.size > 2_000_000_000) { setError('Videos must be 2 GB or smaller.'); return; }
    setError(''); setPhase('Requesting private upload URL…');
    try {
      const signed = await requestUrl.mutateAsync({ data: { name: file.name, size: file.size, contentType } });
      if (!signed.uploadURL || !signed.objectPath) throw new Error('The upload service did not return a complete signed destination.');
      setPhase('Transferring directly to private storage…');
      const result = await fetch(signed.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
      if (!result.ok) throw new Error(`Private storage rejected the transfer (${result.status}).`);
      setPhase('Registering recording…');
      await createVideo.mutateAsync({ data: { name: file.name, camera, location, fileSizeBytes: file.size, objectPath: signed.objectPath } });
      await client.invalidateQueries({ queryKey: getGetVideosQueryKey() });
      await client.invalidateQueries({ queryKey: getGetVisionDashboardQueryKey() });
      setPhase('Upload complete. Source is stored privately; automated analysis is not connected yet.'); setFile(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload could not be completed.'); setPhase(''); }
  }
  const busy = requestUrl.isPending || createVideo.isPending || (!!phase && !phase.startsWith('Upload complete'));
  return <div className="upload-grid fade-up"><section className="panel upload-panel"><div className="upload-kicker"><span className="upload-icon"><CloudUpload size={21} /></span><div><h2>Bring in source footage</h2><p>Private storage · Signed, time-limited upload destination</p></div></div>
    <form onSubmit={submit} className="upload-form">
      <label className={`dropzone ${file ? 'dropzone-picked' : ''}`} htmlFor="footage"><input id="footage" type="file" accept=".mp4,.mov,.avi,.mkv,.webm,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm" onChange={e => setFile(e.target.files?.[0] ?? null)} disabled={busy} data-testid="input-upload-file" /><span className="drop-icon"><Upload size={20} /></span><b>{file ? file.name : 'Choose a video file'}</b><small>{file ? `${formatSize(file.size)} · ${file.type || 'Type inferred from file extension'}` : 'MP4, MOV, AVI, MKV, or WebM · up to 2 GB'}</small><span className="button button-secondary button-small">{file ? 'Choose another' : 'Browse files'}</span></label>
      <div className="form-grid"><label>Camera label<input required value={camera} onChange={e => setCamera(e.target.value)} placeholder="e.g. Loading bay west" data-testid="input-upload-camera" /></label><label>Location<input required value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Building 2 · ground floor" data-testid="input-upload-location" /></label></div>
      <div className="privacy-callout"><ShieldCheck size={18} /><span><b>Upload goes directly to private storage</b><small>We request a signed URL first. File bytes are only transferred after a successful URL response.</small></span></div>
      {error && <div className="inline-error" role="alert"><AlertCircle size={16} />{error}</div>}
      {phase && <div className={`upload-feedback ${phase.startsWith('Upload complete') ? 'feedback-success' : ''}`} role="status">{busy && <LoaderCircle size={16} className="spin" />}{!busy && phase.startsWith('Upload complete') && <CheckCircle2 size={16} />}{phase}</div>}
      <button className="button button-primary upload-submit" disabled={!file || !camera.trim() || !location.trim() || busy} type="submit" data-testid="button-start-upload">{busy ? <><LoaderCircle className="spin" size={16} /> {phase || 'Uploading…'}</> : <><LockMark /> Upload securely</>}</button>
    </form></section>
    <aside className="upload-aside"><div className="side-number">01 / TRANSFER</div><h3>Source first.<br />Review second.</h3><p>Every uploaded recording is kept as a source item. Indexed findings remain timestamped and reviewable alongside it.</p><div className="upload-steps"><div><span>01</span><b>Request destination</b><small>Metadata only; no video bytes sent to the API.</small></div><div><span>02</span><b>Transfer footage</b><small>PUT directly to the signed private-storage URL.</small></div><div><span>03</span><b>Register evidence</b><small>The object path and file details link your source.</small></div></div><div className="caution-note"><AlertTriangle size={16} /><span>Analysis is not a determination of identity or intent.</span></div></aside></div>;
}

function LivePage({ query }: { query: UseQueryResult<DashboardData, Error> }) {
  const cameras = query.data?.cameras ?? [];
  return <div className="page-stack fade-up"><div className="live-banner"><span className="live-signal"><Radio size={18} /></span><div><b>Camera status is informational</b><p>This workspace returns camera status metadata only; it does not display or connect to a live stream.</p></div></div>
    {query.isLoading && <Skeleton count={4} />}{query.isError && <PageError retry={() => query.refetch()} />}
    {query.data && <section className="panel camera-table-panel"><SectionTitle label="Configured cameras" trailing={<span className="table-note">{cameras.length} reported</span>} />
      {cameras.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Camera</th><th>Location</th><th>Connection</th><th>Recent activity</th><th>Indexed events</th></tr></thead><tbody>{cameras.map((c, i) => <tr key={`${c.name}-${i}`}><td><div className="camera-name"><span className={`camera-state camera-${c.status}`} /><b>{c.name}</b></div></td><td>{c.location}</td><td><StatusBadge value={c.status} /></td><td><span className={`activity-tag activity-${c.activity}`}>{c.activity}</span></td><td className="mono">{c.events}</td></tr>)}</tbody></table></div> : <EmptyState title="No camera status received" body="The dashboard has no configured camera status entries." icon={Radio} />}</section>}
  </div>;
}

function InvestigationsPage({ query, events }: { query: UseQueryResult<InvestigationData[], Error>; events: EventData[] }) {
  const [open, setOpen] = useState(false); const [title, setTitle] = useState(''); const [severity, setSeverity] = useState('medium'); const [notes, setNotes] = useState(''); const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const create = useCreateInvestigation(); const client = useQueryClient();
  function submit(e: FormEvent) { e.preventDefault(); create.mutate({ data: { title, severity: severity as 'low' | 'medium' | 'high' | 'critical', notes, eventIds: selectedEvents } }, { onSuccess: () => { void client.invalidateQueries({ queryKey: getGetInvestigationsQueryKey() }); setOpen(false); setTitle(''); setNotes(''); setSelectedEvents([]); } }); }
  const cases = query.data ?? [];
  return <div className="page-stack fade-up"><div className="toolbar toolbar-end"><span className="toolbar-note">{cases.length} cases · {cases.filter(c => c.status !== 'resolved').length} open</span><button onClick={() => setOpen(!open)} className="button button-primary" data-testid="button-new-investigation"><Plus size={16} /> New investigation</button></div>
    {open && <section className="panel form-panel"><div className="form-panel-title"><div><span className="eyebrow">NEW CASE</span><h2>Start an investigation</h2></div><button className="icon-button" aria-label="Close form" onClick={() => setOpen(false)} data-testid="button-close-investigation-form"><X size={17} /></button></div>
      <form onSubmit={submit} className="compact-form"><label>Case title<input required value={title} onChange={e => setTitle(e.target.value)} placeholder="A concise working title" data-testid="input-investigation-title" /></label><label>Severity<select value={severity} onChange={e => setSeverity(e.target.value)} data-testid="select-investigation-severity"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label className="span-all">Review notes<textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Record what is known and what still needs verification." data-testid="input-investigation-notes" /></label>
        {!!events.length && <fieldset className="span-all event-picker"><legend>Attach relevant events (optional)</legend>{events.slice(0, 8).map(ev => <label key={ev.id}><input type="checkbox" checked={selectedEvents.includes(ev.id)} onChange={e => setSelectedEvents(prev => e.target.checked ? [...prev, ev.id] : prev.filter(id => id !== ev.id))} /><span>{ev.eventType} · {ev.videoName} · {formatTime(ev.timestampSeconds)}</span></label>)}</fieldset>}
        {create.isError && <div className="inline-error span-all" role="alert"><AlertCircle size={16} />Could not create the investigation. Try again.</div>}<div className="form-actions span-all"><button className="button button-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="button button-primary" disabled={create.isPending} type="submit" data-testid="button-create-investigation">{create.isPending ? 'Creating…' : 'Create case'}</button></div></form></section>}
    {query.isLoading && <Skeleton count={3} />}{query.isError && <PageError retry={() => query.refetch()} />}
    {query.data && (cases.length ? <section className="panel cases-panel"><SectionTitle label="Case register" /><div className="case-list">{cases.map(c => <article className="case-row" key={c.id} data-testid={`card-investigation-${c.id}`}><span className="case-index mono">{c.id.slice(0, 5).toUpperCase()}</span><div className="case-main"><b>{c.title}</b><p>{c.notes || 'No review notes recorded.'}</p><small>{formatDate(c.createdAt)} · {c.eventIds.length} linked events</small></div><Severity value={c.severity} /><StatusBadge value={c.status} /></article>)}</div></section> : <section className="panel"><EmptyState title="No investigations yet" body="Create a case to group timestamped events and document review context." icon={Shield} action={<button className="button button-primary button-small" onClick={() => setOpen(true)} data-testid="button-empty-investigation"><Plus size={15} /> Create investigation</button>} /></section>)}
  </div>;
}

function EventsPage({ query }: { query: UseQueryResult<EventData[], Error> }) {
  const review = useReviewEvent(); const client = useQueryClient(); const [filter, setFilter] = useState('all');
  function update(id: string, reviewStatus: 'needs_review' | 'confirmed' | 'dismissed') { review.mutate({ eventId: id, data: { reviewStatus } }, { onSuccess: () => { void client.invalidateQueries({ queryKey: getGetEventsQueryKey() }); void client.invalidateQueries({ queryKey: getGetVisionDashboardQueryKey() }); } }); }
  const rows = (query.data ?? []).filter(e => filter === 'all' || e.reviewStatus === filter);
  return <div className="page-stack fade-up"><div className="toolbar"><label className="select-wrap"><SlidersHorizontal size={15} /><select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter event review status" data-testid="select-event-status"><option value="all">All review states</option><option value="needs_review">Needs review</option><option value="confirmed">Confirmed</option><option value="dismissed">Dismissed</option></select></label><span className="toolbar-note">{rows.length} timestamped findings</span></div>
    {review.isError && <div className="inline-error" role="alert"><AlertCircle size={16} />Review update failed. Please retry from the event.</div>}{query.isLoading && <Skeleton count={5} />}{query.isError && <PageError retry={() => query.refetch()} />}
    {query.data && <section className="panel events-review-panel">{rows.length ? <div className="review-list">{rows.map(e => <article className="review-event" key={e.id} data-testid={`card-event-${e.id}`}><div className={`event-mark mark-${e.severity}`}><Activity size={17} /></div><div className="review-main"><div className="review-heading"><b>{e.eventType}</b><Severity value={e.severity} /><StatusBadge value={e.reviewStatus} /></div><p>{e.description}</p><div className="evidence-meta"><span><Film size={13} />{e.videoName}</span><span className="mono"><Clock3 size={12} />{formatTime(e.timestampSeconds)}</span><span><MapPin size={13} />{e.location}</span><span className="evidence-label">{e.evidenceLabel}</span></div><div className="confidence-track"><span>Model confidence</span><div><i style={{ width: `${Math.round(e.confidence * 100)}%` }} /></div><b>{Math.round(e.confidence * 100)}%</b><small>Not proof</small></div></div><div className="review-actions"><button className="button button-confirm" onClick={() => update(e.id, 'confirmed')} disabled={review.isPending || e.reviewStatus === 'confirmed'} data-testid={`button-confirm-event-${e.id}`}><Check size={14} /> Confirm</button><button className="button button-quiet" onClick={() => update(e.id, 'dismissed')} disabled={review.isPending || e.reviewStatus === 'dismissed'} data-testid={`button-dismiss-event-${e.id}`}>Dismiss</button></div></article>)}</div> : <EmptyState title="No events to display" body={query.data.length ? 'No events match this review filter.' : 'Timestamped findings will appear after footage is indexed.'} icon={Eye} />}</section>}
  </div>;
}

function PeoplePage({ dash }: { dash: UseQueryResult<DashboardData, Error> }) {
  const events = dash.data?.recentEvents ?? [];
  return <div className="page-stack fade-up"><div className="privacy-banner"><Fingerprint size={20} /><div><b>Anonymous tracks only</b><p>Track counts describe event-level observations. This workspace does not identify people, compare faces, or assert who someone is.</p></div><span className="privacy-tag">IDENTITY NOT INFERRED</span></div>
    {dash.isLoading && <Skeleton count={3} />}{dash.isError && <PageError retry={() => dash.refetch()} />}
    {dash.data && <><div className="track-metrics"><Metric value={dash.data.peopleDetected} label="People observations" meta="Aggregate count across indexed footage" /><Metric value={dash.data.uniqueTracks} label="Anonymous tracks" meta="Track totals; not unique identities" /><Metric value={dash.data.videosAnalyzed} label="Recordings reviewed" meta="Available in current workspace" /></div>
      <section className="panel track-panel"><SectionTitle label="Recent track-related evidence" /><p className="panel-subtitle">Findings are shown as recorded descriptions; no identity labels are displayed.</p>{events.length ? <div className="event-list">{events.map(e => <div className="track-row" key={e.id}><span className="track-symbol"><Fingerprint size={16} /></span><div><b>{e.evidenceLabel || e.eventType}</b><p>{e.description}</p><small>{e.videoName} · <span className="mono">{formatTime(e.timestampSeconds)}</span> · {e.location}</small></div><Severity value={e.severity} /></div>)}</div> : <EmptyState title="No track evidence" body="No relevant timestamped evidence is currently available." icon={Fingerprint} />}</section>
    </>}
  </div>;
}

function SearchPage({ videos }: { videos: VideoData[] }) {
  const search = useSearchEvidence(); const [text, setText] = useState(''); const [videoId, setVideoId] = useState('');
  function submit(e: FormEvent) { e.preventDefault(); if (text.trim()) search.mutate({ data: { query: text.trim(), ...(videoId ? { videoId } : {}) } }); }
  return <div className="page-stack fade-up"><section className="search-hero panel"><div className="search-hero-label"><Search size={15} /> INDEXED EVIDENCE</div><h2>What are you looking for?</h2><p>Search stored event descriptions; this does not inspect video pixels.</p><form className="evidence-search-form" onSubmit={submit}><Search size={18} /><input value={text} onChange={e => setText(e.target.value)} placeholder="e.g. movement near the east entrance" aria-label="Search evidence" data-testid="input-evidence-query" /><select value={videoId} onChange={e => setVideoId(e.target.value)} aria-label="Limit to recording" data-testid="select-search-video"><option value="">All recordings</option>{videos.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select><button className="button button-primary" type="submit" disabled={!text.trim() || search.isPending} data-testid="button-search-evidence">{search.isPending ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />} Search</button></form></section>
    {search.isError && <PageError text="Search could not be completed. Your query has not been changed." retry={() => text.trim() && search.mutate({ data: { query: text.trim(), ...(videoId ? { videoId } : {}) } })} />}
    {search.isPending && <Skeleton count={4} />}
    {search.data && <section className="panel search-results"><SectionTitle label={`${search.data.length} matching moments`} trailing={<span className="table-note">Search results are candidate evidence</span>} />{search.data.length ? <div className="event-list">{search.data.map(e => <EvidenceResult key={e.id} event={e} />)}</div> : <EmptyState title="No matching moments" body="Try broader wording or search all recordings." icon={Search} />}</section>}
    {!search.data && !search.isPending && <section className="panel search-guidance"><div className="guidance-head"><span className="empty-icon"><Command size={19} /></span><div><b>Search tips</b><p>Use plain language from the event description or specify a location, activity, and recording.</p></div></div><div className="suggestion-pills"><button onClick={() => setText('movement near an entrance')} data-testid="button-search-suggestion-entrance">Movement near an entrance</button><button onClick={() => setText('items left unattended')} data-testid="button-search-suggestion-items">Items left unattended</button><button onClick={() => setText('after-hours activity')} data-testid="button-search-suggestion-hours">After-hours activity</button></div></section>}
  </div>;
}
function EvidenceResult({ event }: { event: EventData }) {
  return <article className="evidence-result" data-testid={`row-search-result-${event.id}`}><div className="evidence-time"><span className="mono">{formatTime(event.timestampSeconds)}</span><small>VIDEO TIME</small></div><div className="evidence-body"><div><b>{event.eventType}</b><Severity value={event.severity} /></div><p>{event.description}</p><small>{event.videoName} · {event.location} · {event.evidenceLabel}</small></div><div className="evidence-confidence"><span>Confidence</span><b>{Math.round(event.confidence * 100)}%</b><small>Estimate</small></div><StatusBadge value={event.reviewStatus} /></article>;
}

function AskPage({ videos }: { videos: VideoData[] }) {
  const ask = useAskAboutEvidence(); const [question, setQuestion] = useState(''); const [videoId, setVideoId] = useState('');
  function submit(e: FormEvent) { e.preventDefault(); if (question.trim()) ask.mutate({ data: { question: question.trim(), ...(videoId ? { videoId } : {}) } }); }
  const answer = ask.data;
  return <div className="ask-layout fade-up"><main className="ask-main"><section className="ask-intro"><span className="ask-icon"><Sparkles size={18} /></span><span className="eyebrow">EVIDENCE-BOUNDED ASSISTANT</span><h2>Ask a question.<br /><em>Keep the evidence close.</em></h2><p>Currently uses local text matching, not a generative model. It matches stored event descriptions, cites timestamps, and does not interpret raw video.</p></section>
      <form className="ask-form panel" onSubmit={submit}><label htmlFor="ask-question">Your question</label><textarea id="ask-question" rows={3} value={question} onChange={e => setQuestion(e.target.value)} placeholder="What was recorded near the loading entrance?" data-testid="input-ask-question" /><div className="ask-form-bottom"><select value={videoId} onChange={e => setVideoId(e.target.value)} aria-label="Limit question to a recording" data-testid="select-ask-video"><option value="">All indexed recordings</option>{videos.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select><button className="button button-primary" disabled={!question.trim() || ask.isPending} type="submit" data-testid="button-ask-evidence">{ask.isPending ? <LoaderCircle size={16} className="spin" /> : <Send size={15} />} Ask about evidence</button></div></form>
      {ask.isError && <PageError text="The evidence question could not be answered. Please try again." retry={() => question.trim() && ask.mutate({ data: { question: question.trim(), ...(videoId ? { videoId } : {}) } })} />}
      {ask.isPending && <div className="answer-loading panel"><Skeleton count={2} /><small>Checking indexed evidence…</small></div>}
      {answer && <section className="answer-card panel" data-testid="card-ai-answer"><div className="answer-status"><span className={answer.grounded ? 'grounded-chip' : 'ungrounded-chip'}>{answer.grounded ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}{answer.grounded ? 'Evidence-grounded response' : 'Not enough evidence'}</span><span className="answer-confidence">Confidence estimate <b>{Math.round(answer.confidence * 100)}%</b></span></div><p className="answer-text">{answer.answer}</p>{!answer.grounded && <div className="not-enough"><AlertCircle size={16} /><span>There is not enough indexed evidence to support a confident answer. Treat the response as inconclusive; review the source footage.</span></div>}<div className="answer-evidence-head"><b>Evidence cited</b><span>{answer.evidence.length} records</span></div>{answer.evidence.length ? <div className="cited-evidence">{answer.evidence.map(e => <EvidenceResult event={e} key={e.id} />)}</div> : <div className="citation-empty"><HelpCircle size={16} />No matching event timestamps were returned; this answer is not supported by cited records.</div>}<small className="answer-disclaimer">AI output is a navigation aid, not a factual determination. Confirm details in the original recording.</small></section>}
      {!answer && !ask.isPending && <div className="question-examples"><span>Try asking</span><button onClick={() => setQuestion('What events were recorded in this video?')} data-testid="button-ask-example-events">“What events were recorded?”</button><button onClick={() => setQuestion('When was activity recorded near the entrance?')} data-testid="button-ask-example-entrance">“When was activity near the entrance?”</button></div>}
    </main><aside className="ask-rail"><div className="ask-rail-art"><div className="reticle"><span /><i /><b /></div><span className="art-coord mono">VG / EVIDENCE</span></div><div className="ask-rail-copy"><span className="eyebrow">A REVIEW TOOL, NOT AN ORACLE</span><h3>Show your work.</h3><p>Answers include cited event timestamps. No source records means no supported conclusion.</p><div className="confidence-key"><span><i className="key-solid" />Grounded in matching evidence</span><span><i className="key-outline" />Inconclusive; verify manually</span></div></div></aside></div>;
}

function AlertsPage({ query }: { query: UseQueryResult<AlertRuleData[], Error> }) {
  const [open, setOpen] = useState(false); const [name, setName] = useState(''); const [trigger, setTrigger] = useState(''); const [severity, setSeverity] = useState('medium'); const create = useCreateAlert(); const update = useUpdateAlertStatus(); const client = useQueryClient();
  function submit(e: FormEvent) { e.preventDefault(); create.mutate({ data: { name, trigger, severity: severity as 'low' | 'medium' | 'high' | 'critical' } }, { onSuccess: () => { void client.invalidateQueries({ queryKey: getGetAlertsQueryKey() }); setName(''); setTrigger(''); setOpen(false); } }); }
  function setState(id: string, status: 'active' | 'paused') { update.mutate({ alertId: id, data: { status } }, { onSuccess: () => void client.invalidateQueries({ queryKey: getGetAlertsQueryKey() }) }); }
  const rules = query.data ?? [];
  return <div className="page-stack fade-up"><div className="toolbar toolbar-end"><span className="toolbar-note"><span className="online-dot" /> {rules.filter(r => r.status === 'active').length} active rules</span><button className="button button-primary" onClick={() => setOpen(!open)} data-testid="button-new-alert"><Plus size={16} /> Create alert rule</button></div>
    {open && <section className="panel form-panel"><div className="form-panel-title"><div><span className="eyebrow">NEW RULE</span><h2>Choose a review trigger</h2></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close alert form" data-testid="button-close-alert-form"><X size={17} /></button></div><form className="compact-form" onSubmit={submit}><label>Rule name<input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. After-hours perimeter activity" data-testid="input-alert-name" /></label><label>Severity<select value={severity} onChange={e => setSeverity(e.target.value)} data-testid="select-alert-severity"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label className="span-all">Trigger description<input required value={trigger} onChange={e => setTrigger(e.target.value)} placeholder="Describe the event condition to surface for review" data-testid="input-alert-trigger" /></label>{create.isError && <div className="inline-error span-all" role="alert">Could not create this alert rule.</div>}<div className="form-actions span-all"><button className="button button-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={create.isPending} data-testid="button-create-alert">{create.isPending ? 'Creating…' : 'Save rule'}</button></div></form></section>}
    {(create.isError || update.isError) && <div className="inline-error" role="alert"><AlertCircle size={16} />The rule could not be updated. Retry the action.</div>}{query.isLoading && <Skeleton count={4} />}{query.isError && <PageError retry={() => query.refetch()} />}
    {query.data && <section className="panel rules-panel"><SectionTitle label="Configured rules" />{rules.length ? <div className="rule-list">{rules.map(rule => <article key={rule.id} className="rule-row" data-testid={`row-alert-${rule.id}`}><span className="rule-icon"><Bell size={17} /></span><div className="rule-main"><b>{rule.name}</b><p>{rule.trigger}</p><small>Created {formatDate(rule.createdAt)}</small></div><Severity value={rule.severity} /><StatusBadge value={rule.status} /><button className={`button ${rule.status === 'active' ? 'button-secondary' : 'button-confirm'}`} onClick={() => setState(rule.id, rule.status === 'active' ? 'paused' : 'active')} disabled={update.isPending} data-testid={`button-toggle-alert-${rule.id}`}>{rule.status === 'active' ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}</button></article>)}</div> : <EmptyState title="No alert rules" body="Create a rule to surface matching event descriptions for human review." icon={Bell} />}</section>}
  </div>;
}

function ReportsPage({ query, videos }: { query: UseQueryResult<ReportData[], Error>; videos: VideoData[] }) {
  const create = useCreateReport(); const client = useQueryClient(); const [videoId, setVideoId] = useState('');
  function submit(e: FormEvent) { e.preventDefault(); if (!videoId) return; create.mutate({ data: { videoId } }, { onSuccess: () => { void client.invalidateQueries({ queryKey: getGetReportsQueryKey() }); setVideoId(''); } }); }
  const reports = query.data ?? [];
  return <div className="page-stack fade-up"><section className="panel report-create"><div><span className="report-create-icon"><FileText size={18} /></span><div><b>Generate from evidence</b><p>Request a report based on an indexed video record.</p></div></div><form onSubmit={submit}><select aria-label="Choose recording for report" value={videoId} onChange={e => setVideoId(e.target.value)} data-testid="select-report-video"><option value="">Select a recording</option>{videos.map(v => <option value={v.id} key={v.id}>{v.name}</option>)}</select><button className="button button-primary" disabled={!videoId || create.isPending} data-testid="button-generate-report">{create.isPending ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />} Generate report</button></form></section>
    {create.isError && <div className="inline-error" role="alert"><AlertCircle size={16} />Report generation request failed.</div>}{query.isLoading && <Skeleton count={4} />}{query.isError && <PageError retry={() => query.refetch()} />}
    {query.data && <section className="panel report-list-panel"><SectionTitle label={`${reports.length} reports`} />{reports.length ? <div className="report-list">{reports.map(r => <article className="report-row" key={r.id} data-testid={`row-report-${r.id}`}><span className="report-icon"><FileText size={17} /></span><div className="report-main"><b>{r.title}</b><p>{r.summary}</p><small>{formatDate(r.createdAt)} · Source video {r.videoId}</small></div><Severity value={r.severity} /><StatusBadge value={r.status} /><span className="report-state-icon" aria-label={`Report ${r.status}`} data-testid={`status-report-${r.id}`}>{r.status === 'ready' ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}</span></article>)}</div> : <EmptyState title="No reports yet" body="Choose an indexed recording above to request your first report." icon={FileText} />}</section>}
  </div>;
}

function AnalyticsPage({ dash }: { dash: UseQueryResult<DashboardData, Error> }) {
  const d = dash.data;
  return <div className="page-stack fade-up">{dash.isLoading && <Skeleton count={5} />}{dash.isError && <PageError retry={() => dash.refetch()} />}{d && <>
    <div className="analytics-metrics"><Metric value={d.videosAnalyzed} label="Videos analyzed" meta="Indexed recordings" /><Metric value={d.totalEvents} label="Events surfaced" meta="Timestamped records" /><Metric value={d.unusualEvents} label="Unusual events" meta="Flagged for review" /><Metric value={`${Math.round(d.confidence * 100)}%`} label="Mean confidence" meta="Estimate across indexed findings" /></div>
    <div className="analytics-grid"><section className="panel analytics-volume"><SectionTitle label="Event volume over time" trailing={<span className="chart-legend"><i />Indexed events</span>} />{d.activity.length ? <ActivityChart points={d.activity.map(a => a.value)} labels={d.activity.map(a => a.time)} /> : <EmptyState title="No activity data" body="No indexed activity series is available." icon={BarChart3} />}</section>
      <section className="panel confidence-panel"><SectionTitle label="Confidence distribution" /><div className="confidence-big"><strong>{Math.round(d.confidence * 100)}<small>%</small></strong><span>Average model confidence</span></div><div className="confidence-meter"><i style={{ width: `${Math.max(0, Math.min(100, Math.round(d.confidence * 100)))}%` }} /></div><div className="confidence-foot"><span>Lower estimate</span><span>Higher estimate</span></div><p>Confidence measures model certainty for surfaced evidence. It does not establish accuracy, intent, or identity.</p></section></div>
    <section className="panel analytics-bottom"><SectionTitle label="Review context" /><div className="context-grid"><div><span>People observations</span><b>{d.peopleDetected}</b><small>Aggregate observations, not unique individuals</small></div><div><span>Anonymous tracks</span><b>{d.uniqueTracks}</b><small>No facial identity claims</small></div><div><span>Important clips</span><b>{d.importantClips}</b><small>Candidate moments for review</small></div><div><span>Critical alerts</span><b>{d.criticalAlerts}</b><small>Check linked source events</small></div></div></section>
  </>}</div>;
}

function SettingsPage() {
  const [compact, setCompact] = useState(false);
  return <div className="settings-layout fade-up"><section className="panel settings-main"><SectionTitle label="Workspace preferences" /><div className="setting-row"><div><b>Dense scanning</b><p>Use tighter row spacing for high-volume event review.</p></div><button className={`toggle ${compact ? 'toggle-on' : ''}`} role="switch" aria-checked={compact} aria-label="Dense scanning" onClick={() => setCompact(!compact)} data-testid="button-toggle-dense-scanning"><i /></button></div><div className="setting-row"><div><b>Workspace identity</b><p>VisionGuard workspace · Security review</p></div><span className="status-badge">Managed</span></div><div className="setting-row"><div><b>Source retention</b><p>No automatic retention period is configured in this MVP.</p></div><span className="muted">Not configured</span></div></section>
    <aside className="panel settings-guide"><div className="settings-guide-icon"><ShieldCheck size={21} /></div><span className="eyebrow">REVIEW PRINCIPLES</span><h3>Evidence before inference.</h3><p>Keep the difference clear between recorded observations, model estimates, and verified conclusions.</p><ul><li>Review each moment against its original timestamp.</li><li>Treat confidence as a sorting signal, not proof.</li><li>Tracks are anonymous; facial identity is not inferred.</li><li>Ask AI results cite evidence or clearly say when evidence is insufficient.</li></ul></aside>
  </div>;
}

function SignInScreen({ onSignIn }: { onSignIn: () => void }) {
  return <main className="sign-in-page"><section className="sign-in-card"><span className="sign-in-mark"><ShieldCheck size={24} /></span><span className="eyebrow">PRIVATE SECURITY WORKSPACE</span><h1>VisionGuard AI</h1><p>Review recorded activity with timestamped evidence, clear uncertainty, and human oversight.</p><div className="sign-in-privacy"><Shield size={16} /><span>Footage and review records are available only after you sign in.</span></div><button className="button button-primary sign-in-button" onClick={onSignIn} data-testid="button-sign-in">Continue to sign in <ArrowUpRight size={16} /></button><small>Access is protected by your Replit workspace identity.</small></section></main>;
}

function SessionGate() {
  const auth = useAuth();
  if (auth.isLoading) {
    return <main className="sign-in-page"><section className="sign-in-card sign-in-loading" aria-live="polite"><span className="sign-in-mark"><ShieldCheck size={24} /></span><b>Checking workspace access…</b></section></main>;
  }
  if (!auth.user) return <SignInScreen onSignIn={auth.login} />;
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RoutedErrorBoundary><Shell user={auth.user} onLogout={auth.logout} /></RoutedErrorBoundary></WouterRouter>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><SessionGate /><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
