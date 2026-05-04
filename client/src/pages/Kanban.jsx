import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client';
import Spinner from '../components/Spinner';
import {
  HiExternalLink,
  HiOutlineCog,
  HiPlay,
  HiOutlinePencilAlt,
  HiCheck,
  HiX,
} from 'react-icons/hi';

// Six-column status board. Status changes use explicit action buttons
// rather than drag-drop — simpler, works on touch, and the action label
// doubles as a clear micro-confirmation of what just happened.

const COLUMNS = [
  { key: 'new', label: 'New', accent: 'bg-primary-500' },
  { key: 'saved', label: 'Saved', accent: 'bg-yellow-500' },
  { key: 'applied', label: 'Applied', accent: 'bg-blue-500' },
  { key: 'interview', label: 'Interview', accent: 'bg-green-500' },
  { key: 'rejected', label: 'Rejected', accent: 'bg-red-500' },
  { key: 'archived', label: 'Archived', accent: 'bg-surface-400' },
];

const TRANSITIONS = {
  new: ['saved', 'applied', 'rejected', 'archived'],
  saved: ['applied', 'rejected', 'archived'],
  applied: ['interview', 'rejected', 'archived'],
  interview: ['applied', 'rejected', 'archived'],
  rejected: ['saved', 'archived'],
  archived: ['new'],
};

const FRESHNESS_LABEL = {
  today: { text: 'today', className: 'bg-green-100 text-green-700' },
  week: { text: 'this week', className: 'bg-primary-100 text-primary-700' },
  month: { text: 'this month', className: 'bg-surface-100 text-surface-600' },
  stale: { text: 'stale', className: 'bg-red-100 text-red-600' },
};

export default function Kanban() {
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [postings, setPostings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const loadProfiles = async () => {
    try {
      const { data } = await client.get('/jobs/profiles');
      setProfiles(data);
    } catch {
      toast.error('Failed to load profiles');
    }
  };

  const loadPostings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedProfileId) params.set('profileId', selectedProfileId);
      params.set('limit', '500');
      const { data } = await client.get(`/jobs/postings?${params.toString()}`);
      setPostings(data);
    } catch {
      toast.error('Failed to load postings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    loadPostings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfileId]);

  const columns = useMemo(() => {
    const byStatus = {
      new: [], saved: [], applied: [], interview: [], rejected: [], archived: [],
    };
    for (const p of postings) {
      const list = byStatus[p.userStatus];
      if (list) list.push(p);
    }
    return byStatus;
  }, [postings]);

  const handleRunAll = async () => {
    if (profiles.length === 0) {
      toast.error('Create a search profile first');
      return;
    }
    const activeProfiles = profiles.filter((p) => p.active);
    if (activeProfiles.length === 0) {
      toast.error('No active profiles');
      return;
    }

    setRunning(true);
    const toastId = toast.loading(
      `Running ${activeProfiles.length} profile${activeProfiles.length === 1 ? '' : 's'}…`
    );
    try {
      let totalFound = 0;
      let totalNew = 0;
      for (const p of activeProfiles) {
        const { data } = await client.post(`/jobs/profiles/${p.id}/run`);
        totalFound += data.found;
        totalNew += data.new;
      }
      toast.success(
        `${totalFound} posting${totalFound === 1 ? '' : 's'} (${totalNew} new)`,
        { id: toastId }
      );
      loadPostings();
    } catch (error) {
      toast.error(
        error?.response?.data?.error || 'Run failed — see server logs',
        { id: toastId }
      );
    } finally {
      setRunning(false);
    }
  };

  const handleStatusChange = async (postingId, newStatus) => {
    try {
      await client.patch(`/jobs/postings/${postingId}`, { userStatus: newStatus });
      setPostings((prev) =>
        prev.map((p) =>
          p.id === postingId
            ? {
                ...p,
                userStatus: newStatus,
                appliedAt:
                  newStatus === 'applied' && !p.appliedAt
                    ? new Date().toISOString()
                    : p.appliedAt,
              }
            : p
        )
      );
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleNotesSave = async (postingId, notes) => {
    try {
      await client.patch(`/jobs/postings/${postingId}`, { userNotes: notes });
      setPostings((prev) =>
        prev.map((p) => (p.id === postingId ? { ...p, userNotes: notes } : p))
      );
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
    }
  };

  if (loading && postings.length === 0) return <Spinner />;

  const visibleColumns = showArchived
    ? COLUMNS
    : COLUMNS.filter((c) => c.key !== 'archived');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Kanban</h1>
          <p className="text-sm text-surface-500 mt-1">
            Daily agent-curated postings. Click a card to open its source.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="px-3 py-2 border border-surface-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All profiles</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-surface-600 px-3 py-2">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
            />
            Show archived
          </label>
          <button
            onClick={handleRunAll}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition text-sm"
          >
            <HiPlay className="w-4 h-4" />
            {running ? 'Running…' : 'Run all now'}
          </button>
          <Link
            to="/profiles"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-300 text-surface-700 hover:bg-surface-50 transition text-sm"
          >
            <HiOutlineCog className="w-4 h-4" />
            Profiles
          </Link>
        </div>
      </div>

      {postings.length === 0 ? (
        <EmptyState profiles={profiles} selectedProfileId={selectedProfileId} />
      ) : (
        <div className="grid grid-flow-col auto-cols-[minmax(300px,1fr)] gap-4 overflow-x-auto pb-4">
          {visibleColumns.map((col) => (
            <Column
              key={col.key}
              col={col}
              postings={columns[col.key] || []}
              onStatusChange={handleStatusChange}
              onNotesSave={handleNotesSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ profiles, selectedProfileId }) {
  return (
    <div className="text-center py-16 border-2 border-dashed border-surface-200 rounded-xl">
      <p className="text-surface-500 mb-2">
        No postings yet{selectedProfileId ? ' for this profile' : ''}.
      </p>
      <p className="text-sm text-surface-400 mb-4">
        {profiles.length === 0
          ? 'Create a search profile to get started.'
          : 'Click "Run all now" above to trigger the agent.'}
      </p>
      {profiles.length === 0 && (
        <Link
          to="/profiles/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition"
        >
          New profile
        </Link>
      )}
    </div>
  );
}

function Column({ col, postings, onStatusChange, onNotesSave }) {
  return (
    <div className="flex flex-col bg-surface-50 rounded-xl p-3 min-h-[60vh]">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${col.accent}`} />
          <h3 className="text-sm font-bold text-surface-900">{col.label}</h3>
          <span className="text-xs text-surface-500">({postings.length})</span>
        </div>
      </div>
      <div className="space-y-3 flex-1">
        {postings.length === 0 ? (
          <p className="text-xs text-surface-400 text-center py-6">Nothing here</p>
        ) : (
          postings.map((p) => (
            <Card
              key={p.id}
              posting={p}
              onStatusChange={onStatusChange}
              onNotesSave={onNotesSave}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Card({ posting, onStatusChange, onNotesSave }) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [noteDraft, setNoteDraft] = useState(posting.userNotes || '');

  const fresh = FRESHNESS_LABEL[posting.freshness] || FRESHNESS_LABEL.month;
  const availableTransitions = TRANSITIONS[posting.userStatus] || [];

  return (
    <div className="bg-white border border-surface-200 rounded-lg p-3 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-surface-900 leading-snug line-clamp-2">
          {posting.title}
        </h4>
        <a
          href={posting.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-surface-400 hover:text-primary-600 transition"
          title="Open source"
        >
          <HiExternalLink className="w-4 h-4" />
        </a>
      </div>

      <p className="text-xs text-surface-600 mt-1">
        <span className="font-medium">{posting.company}</span>
        <span className="text-surface-400"> · {posting.location}</span>
      </p>

      <div className="flex flex-wrap items-center gap-1 mt-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${fresh.className}`}>
          {fresh.text}
        </span>
        {typeof posting.matchScore === 'number' && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
              posting.matchScore >= 0.8
                ? 'bg-green-100 text-green-700'
                : posting.matchScore >= 0.6
                ? 'bg-primary-50 text-primary-700'
                : 'bg-surface-100 text-surface-600'
            }`}
            title="Match score"
          >
            {posting.matchScore.toFixed(2)}
          </span>
        )}
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-surface-500 uppercase tracking-wide">
          {posting.sourceName}
        </span>
      </div>

      {posting.matchReason && (
        <p className="text-[11px] text-surface-500 mt-2 leading-relaxed italic">
          {posting.matchReason}
        </p>
      )}

      {editingNotes ? (
        <div className="mt-2">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={3}
            className="w-full text-xs px-2 py-1 border border-surface-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="Notes, contact name, cover-letter draft…"
            autoFocus
          />
          <div className="flex items-center justify-end gap-1 mt-1">
            <button
              onClick={() => {
                setEditingNotes(false);
                setNoteDraft(posting.userNotes || '');
              }}
              className="p-1 rounded text-surface-500 hover:bg-surface-100"
              title="Cancel"
            >
              <HiX className="w-4 h-4" />
            </button>
            <button
              onClick={async () => {
                await onNotesSave(posting.id, noteDraft);
                setEditingNotes(false);
              }}
              className="p-1 rounded bg-primary-600 text-white hover:bg-primary-700"
              title="Save notes"
            >
              <HiCheck className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : posting.userNotes ? (
        <button
          onClick={() => setEditingNotes(true)}
          className="mt-2 w-full text-left text-[11px] px-2 py-1 rounded bg-yellow-50 border border-yellow-200 text-surface-700 hover:bg-yellow-100 transition"
        >
          {posting.userNotes.slice(0, 140)}
          {posting.userNotes.length > 140 ? '…' : ''}
        </button>
      ) : (
        <button
          onClick={() => setEditingNotes(true)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-surface-500 hover:text-surface-900 transition"
        >
          <HiOutlinePencilAlt className="w-3 h-3" />
          Add note
        </button>
      )}

      <div className="flex flex-wrap gap-1 mt-3 pt-2 border-t border-surface-100">
        {availableTransitions.map((status) => {
          const label = COLUMNS.find((c) => c.key === status)?.label || status;
          return (
            <button
              key={status}
              onClick={() => onStatusChange(posting.id, status)}
              className="text-[10px] px-2 py-0.5 rounded bg-surface-100 text-surface-700 hover:bg-surface-200 transition"
            >
              → {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
