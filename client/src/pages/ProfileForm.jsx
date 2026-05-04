import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client';
import Spinner from '../components/Spinner';
import { HiX, HiArrowLeft, HiPlus } from 'react-icons/hi';

// Chip-input pattern: type a keyword, Enter or comma to commit. Backspace
// on an empty draft removes the last chip. Matches the kind of input
// experience users expect from LinkedIn / Indeed and avoids the
// CSV-pasting surprises of a plain comma-separated text field.
function ChipInput({ label, hint, value, onChange, accent = 'primary' }) {
  const [draft, setDraft] = useState('');

  const add = (raw) => {
    const v = raw.trim().replace(/,+$/, '');
    if (!v) return;
    if (value.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...value, v.slice(0, 100)]);
    setDraft('');
  };

  const remove = (v) => onChange(value.filter((x) => x !== v));

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const accentBg =
    accent === 'red' ? 'bg-red-50 text-red-700' : 'bg-primary-50 text-primary-700';
  const accentRemove =
    accent === 'red' ? 'hover:text-red-900' : 'hover:text-primary-900';

  return (
    <div>
      <label className="block text-sm font-medium text-surface-700 mb-1">
        {label}
      </label>
      {hint && <p className="text-xs text-surface-500 mb-2">{hint}</p>}
      <div className="min-h-[50px] flex flex-wrap gap-2 p-2 border border-surface-300 rounded-lg focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 transition bg-white">
        {value.map((v) => (
          <span
            key={v}
            className={`inline-flex items-center gap-1 text-sm px-2 py-1 rounded ${accentBg}`}
          >
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              className={`text-current opacity-60 ${accentRemove}`}
              aria-label={`Remove ${v}`}
            >
              <HiX className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={value.length === 0 ? 'Type, press Enter or comma' : ''}
          className="flex-1 min-w-[140px] outline-none text-sm"
        />
      </div>
    </div>
  );
}

export default function ProfileForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    keywords: [],
    excludeKw: [],
    location: 'Israel',
    remoteOk: true,
    minYearsExp: '',
    maxResults: 10,
    active: true,
  });

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const { data } = await client.get(`/jobs/profiles/${id}`);
        setForm({
          name: data.name || '',
          keywords: data.keywords || [],
          excludeKw: data.excludeKw || [],
          location: data.location || 'Israel',
          remoteOk: data.remoteOk !== false,
          minYearsExp: data.minYearsExp ?? '',
          maxResults: data.maxResults ?? 10,
          active: data.active !== false,
        });
      } catch {
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    if (form.keywords.length === 0)
      return toast.error('Add at least one keyword');

    setSaving(true);
    const payload = {
      ...form,
      minYearsExp: form.minYearsExp === '' ? null : Number(form.minYearsExp),
      maxResults: Number(form.maxResults),
    };

    try {
      if (isNew) {
        await client.post('/jobs/profiles', payload);
        toast.success('Profile created');
      } else {
        await client.put(`/jobs/profiles/${id}`, payload);
        toast.success('Profile updated');
      }
      navigate('/profiles');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl">
      <Link
        to="/profiles"
        className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-900 mb-4"
      >
        <HiArrowLeft className="w-4 h-4" />
        Back to profiles
      </Link>

      <h1 className="text-2xl font-bold text-surface-900 mb-6">
        {isNew ? 'New search profile' : 'Edit profile'}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white border border-surface-200 rounded-xl p-6"
      >
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">
            Name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. QA Automation — Tel Aviv"
            maxLength={100}
            className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
          />
        </div>

        <ChipInput
          label="Include keywords"
          hint="Match any of these. Add tech, roles, domains — e.g. Playwright, SDET, biotechnology, C#."
          value={form.keywords}
          onChange={(v) => setForm({ ...form, keywords: v })}
        />

        <ChipInput
          label="Exclude keywords"
          hint="Postings whose title or description contains any of these are downgraded or skipped."
          value={form.excludeKw}
          onChange={(v) => setForm({ ...form, excludeKw: v })}
          accent="red"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Min years experience
              <span className="text-surface-400 font-normal"> (optional)</span>
            </label>
            <input
              type="number"
              min="0"
              max="30"
              value={form.minYearsExp}
              onChange={(e) => setForm({ ...form, minYearsExp: e.target.value })}
              placeholder="Leave blank for no filter"
              className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Max postings per run
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={form.maxResults}
              onChange={(e) => setForm({ ...form, maxResults: e.target.value })}
              className="w-full px-3 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            />
            <p className="text-xs text-surface-500 mt-1">
              Hard cap 20. Lower = cheaper per run.
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-6">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.remoteOk}
                onChange={(e) => setForm({ ...form, remoteOk: e.target.checked })}
                className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-surface-700">Remote roles ok</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-surface-700">
                Active{' '}
                <span className="text-xs text-surface-400">
                  (included in daily cron)
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-100">
          <Link
            to="/profiles"
            className="px-4 py-2 rounded-lg text-surface-600 hover:bg-surface-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : isNew ? (
              <>
                <HiPlus className="w-4 h-4" />
                Create profile
              </>
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
