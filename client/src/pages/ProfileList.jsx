import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client';
import Spinner from '../components/Spinner';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  HiPlus,
  HiPencil,
  HiTrash,
  HiPlay,
  HiViewBoards,
  HiCheckCircle,
  HiPause,
} from 'react-icons/hi';

export default function ProfileList() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await client.get('/jobs/profiles');
      setProfiles(data);
    } catch {
      toast.error('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRun = async (profileId, profileName) => {
    setRunningId(profileId);
    const toastId = toast.loading(`Running "${profileName}"… (up to 45s)`);
    try {
      const { data } = await client.post(`/jobs/profiles/${profileId}/run`);
      toast.success(
        `Found ${data.found} posting${data.found === 1 ? '' : 's'} — ${data.new} new`,
        { id: toastId }
      );
      setTimeout(() => navigate('/'), 800);
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Run failed', { id: toastId });
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await client.delete(`/jobs/profiles/${confirmDelete.id}`);
      toast.success(`Deleted "${confirmDelete.name}"`);
      setConfirmDelete(null);
      load();
    } catch {
      toast.error('Failed to delete profile');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Profiles</h1>
          <p className="text-sm text-surface-500 mt-1">
            Saved searches. Each runs daily on the configured cron — results land in the{' '}
            <Link to="/" className="text-primary-600 hover:underline font-medium">
              Kanban
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-300 text-surface-700 hover:bg-surface-50 transition"
          >
            <HiViewBoards className="w-4 h-4" />
            Kanban
          </Link>
          <Link
            to="/profiles/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition"
          >
            <HiPlus className="w-4 h-4" />
            New profile
          </Link>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-surface-200 rounded-xl">
          <p className="text-surface-500 mb-4">
            No search profiles yet. Create one to start getting daily postings.
          </p>
          <Link
            to="/profiles/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition"
          >
            <HiPlus className="w-4 h-4" />
            New profile
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-surface-200 rounded-xl p-5 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-surface-900 truncate">{p.name}</h3>
                    {p.active ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                        <HiCheckCircle className="w-4 h-4" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-surface-400 font-medium">
                        <HiPause className="w-4 h-4" />
                        Paused
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(p.keywords || []).slice(0, 8).map((kw) => (
                      <span
                        key={kw}
                        className="inline-block text-xs px-2 py-0.5 rounded bg-primary-50 text-primary-700"
                      >
                        {kw}
                      </span>
                    ))}
                    {p.keywords?.length > 8 && (
                      <span className="text-xs text-surface-400 px-2 py-0.5">
                        +{p.keywords.length - 8} more
                      </span>
                    )}
                  </div>
                  {p.excludeKw?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.excludeKw.map((kw) => (
                        <span
                          key={kw}
                          className="inline-block text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 line-through"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-surface-500 flex flex-wrap gap-x-4 gap-y-1">
                    <span>📍 {p.location}</span>
                    <span>{p._count?.postings ?? 0} posting{p._count?.postings === 1 ? '' : 's'}</span>
                    <span>{p._count?.runs ?? 0} run{p._count?.runs === 1 ? '' : 's'}</span>
                    <span>Max {p.maxResults}/run</span>
                    {p.remoteOk && <span>🏠 Remote ok</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRun(p.id, p.name)}
                    disabled={runningId === p.id || !p.active}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
                    title={p.active ? 'Run now' : 'Profile is paused'}
                  >
                    <HiPlay className="w-4 h-4" />
                    {runningId === p.id ? 'Running…' : 'Run'}
                  </button>
                  <Link
                    to={`/profiles/${p.id}`}
                    className="p-2 rounded-lg text-surface-600 hover:bg-surface-100 transition"
                    title="Edit"
                  >
                    <HiPencil className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => setConfirmDelete(p)}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition"
                    title="Delete"
                  >
                    <HiTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete search profile?"
          message={`"${confirmDelete.name}" and all of its postings will be removed. This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
