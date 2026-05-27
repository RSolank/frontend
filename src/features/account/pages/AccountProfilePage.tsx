import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { userKeys } from '../../users/api/keys';
import { updateProfileRequest } from '../../users/api/mutations';
import { useCurrentUserQuery } from '../../users/api/queries';

interface FormState {
  first_name: string;
  last_name: string;
  dob: string;
  contact_local: string;
}

const INITIAL_FORM: FormState = {
  first_name: '',
  last_name: '',
  dob: '',
  contact_local: '',
};

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

function extractLocalContact(contact: string | null | undefined): string {
  if (!contact) return '';
  return contact.startsWith('+') ? contact.replace(/^\+\d{1,4}/, '') : contact;
}

function extractDialCode(contact: string | null | undefined): string | null {
  if (!contact) return null;
  const match = /^\+(\d{1,4})/.exec(contact);
  return match ? `+${match[1]}` : null;
}

export function AccountProfilePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useCurrentUserQuery();
  const user = data?.user;

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [dialCode, setDialCode] = useState('+91');
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || hydrated) return;
    setForm({
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      dob: user.dob ?? '',
      contact_local: extractLocalContact(user.contact),
    });
    setDialCode(extractDialCode(user.contact) ?? '+91');
    setHydrated(true);
  }, [user, hydrated]);

  const email = user?.email_id ?? '';

  const phoneError = useMemo(() => {
    const digits = form.contact_local.replace(/[^\d]/g, '');
    if (!digits) return null;
    if (digits.length < 7 || digits.length > 15) {
      return 'Phone number should be 7–15 digits.';
    }
    return null;
  }, [form.contact_local]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (phoneError) {
      setError(phoneError);
      return;
    }

    const phoneDigits = form.contact_local.replace(/[^\d]/g, '');
    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      dob: form.dob || null,
      contact: phoneDigits ? `${dialCode}${phoneDigits}` : null,
    };

    try {
      await updateProfileRequest(payload);
      await queryClient.invalidateQueries({ queryKey: userKeys.all });
      setSaved(true);
    } catch (err) {
      const e = err as ApiErrorShape;
      setError(e.detail || e.error || 'Failed to save');
    }
  }

  if (isLoading || !user) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
    );
  }

  // Card-anchored layout (Batch 9 polish): the breadcrumb already reads
  // "Account › Profile", so the page renders no in-content title. The
  // first card becomes the first element in the main column and its
  // top edge aligns with the sidebar's first NavLink top edge.
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800">
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div>
            <label htmlFor="account-first-name" className="form-label">
              First name <span className="text-rose-600">*</span>
            </label>
            <input
              id="account-first-name"
              name="first_name"
              value={form.first_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, first_name: e.target.value }))
              }
              required
              className="form-input"
            />
          </div>
          <div>
            <label htmlFor="account-last-name" className="form-label">
              Last name <span className="text-rose-600">*</span>
            </label>
            <input
              id="account-last-name"
              name="last_name"
              value={form.last_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, last_name: e.target.value }))
              }
              required
              className="form-input"
            />
          </div>
          <div>
            <label htmlFor="account-dob" className="form-label">
              Date of birth
            </label>
            <input
              id="account-dob"
              type="date"
              name="dob"
              value={form.dob}
              onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
              className="form-input"
            />
          </div>
          <div>
            <label htmlFor="account-email" className="form-label">
              Email (read-only)
            </label>
            <input
              id="account-email"
              type="email"
              name="email_id"
              value={email}
              readOnly
              className="form-input"
            />
          </div>
          <div>
            <label htmlFor="account-contact" className="form-label">
              Contact (phone)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                name="dialCode"
                aria-label="Dial code"
                value={dialCode}
                onChange={(e) => setDialCode(e.target.value)}
                className="form-input"
                style={{ width: '4.5rem' }}
              />
              <input
                id="account-contact"
                type="tel"
                name="contact_local"
                value={form.contact_local}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_local: e.target.value }))
                }
                placeholder="Phone number (optional)"
                className="form-input"
                style={{ flex: 1 }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Dial code defaults to your country (set under{' '}
              <a
                href="/account/preferences"
                className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Preferences
              </a>
              ); override here if your phone is from a different region.
            </p>
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary !w-auto">
              Save
            </button>
            {saved && (
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Saved
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
