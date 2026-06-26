import { useEffect, useState } from 'react';

import { apiFetch } from '../../../shared/api/apiClient';
import { buildAliasCheckUrl } from '../api/aliases';
import type { AliasUniqueResponse } from '../api/queries';

type CheckStatus = null | 'checking' | 'unique' | 'taken' | 'duplicate';

interface AliasChipsInputProps {
  aliases?: string[];
  onChange: (next: string[]) => void;
  readOnly?: boolean;
  excludeUid?: number | null;
  onValidityChange?: (invalid: boolean) => void;
}

export function AliasChipsInput({
  aliases = [],
  onChange,
  readOnly = false,
  excludeUid = null,
  onValidityChange,
}: AliasChipsInputProps) {
  const [aliasTemp, setAliasTemp] = useState('');
  const [checkStatus, setCheckStatus] = useState<CheckStatus>(null);

  useEffect(() => {
    if (readOnly) return;
    const val = aliasTemp.trim();
    if (!val) {
      setCheckStatus(null);
      onValidityChange?.(false);
      return;
    }
    if (aliases.some((a) => a.toLowerCase() === val.toLowerCase())) {
      setCheckStatus('duplicate');
      onValidityChange?.(true);
      return;
    }

    setCheckStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const result = await apiFetch<AliasUniqueResponse>(
          buildAliasCheckUrl(val, excludeUid)
        );
        const status: CheckStatus = result.unique ? 'unique' : 'taken';
        setCheckStatus(status);
        onValidityChange?.(status === 'taken');
      } catch {
        setCheckStatus(null);
        onValidityChange?.(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [aliasTemp, aliases, excludeUid, readOnly, onValidityChange]);

  async function handleAdd() {
    const val = aliasTemp.trim();
    if (!val) return;
    if (aliases.some((a) => a.toLowerCase() === val.toLowerCase())) {
      setCheckStatus('duplicate');
      onValidityChange?.(true);
      return;
    }
    if (checkStatus !== 'unique') {
      try {
        const result = await apiFetch<AliasUniqueResponse>(
          buildAliasCheckUrl(val, excludeUid)
        );
        if (!result.unique) {
          setCheckStatus('taken');
          onValidityChange?.(true);
          return;
        }
      } catch {
        alert('Could not verify alias uniqueness');
        return;
      }
    }
    onChange([...aliases, val]);
    setAliasTemp('');
    setCheckStatus(null);
    onValidityChange?.(false);
  }

  function handleRemove(val: string) {
    onChange(aliases.filter((a) => a !== val));
    onValidityChange?.(false);
  }

  const statusMessage = () => {
    if (readOnly || !aliasTemp.trim()) return null;
    if (checkStatus === 'checking')
      return (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Checking availability…
        </span>
      );
    if (checkStatus === 'unique')
      return (
        <span className="text-success-600 dark:text-success-400 text-xs">
          Alias is available
        </span>
      );
    if (checkStatus === 'taken')
      return (
        <span className="text-danger-600 dark:text-danger-400 text-xs">
          Alias already in use
        </span>
      );
    if (checkStatus === 'duplicate')
      return (
        <span className="text-danger-600 dark:text-danger-400 text-xs">
          Alias already added
        </span>
      );
    return null;
  };

  const canAdd = !readOnly && !!aliasTemp.trim() && checkStatus === 'unique';
  const invalidBorder =
    checkStatus === 'taken' || checkStatus === 'duplicate'
      ? '!border-danger-400 dark:!border-danger-700'
      : '';

  return (
    <div className="mb-4">
      <span className="form-label">Aliases</span>

      {!readOnly && (
        <>
          <div className="mb-2 flex gap-2">
            <input
              value={aliasTemp}
              onChange={(e) => setAliasTemp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (canAdd) handleAdd();
                }
              }}
              placeholder="Enter alias (e.g. Jio, Airtel)"
              className={`form-input flex-1 ${invalidBorder}`}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              className="tap-press rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:disabled:bg-slate-900/40 dark:disabled:text-slate-500"
            >
              Add alias
            </button>
          </div>
          <div className="mb-2 min-h-[1.2rem]">{statusMessage()}</div>
        </>
      )}

      <div className="flex min-h-12 flex-wrap gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/40">
        {aliases.length === 0 ? (
          <span className="text-sm text-slate-400 dark:text-slate-500">
            No aliases added
          </span>
        ) : (
          aliases.map((a) => (
            <span
              key={a}
              className="border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-900/50 dark:bg-accent-950/40 dark:text-accent-300 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
            >
              {a}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleRemove(a)}
                  aria-label={`Remove alias ${a}`}
                  className="tap-press text-accent-500 dark:text-accent-400 ml-0.5 text-base leading-none font-bold"
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
