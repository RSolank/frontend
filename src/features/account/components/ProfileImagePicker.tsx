import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import {
  ProfileImage,
  profileImageSrc,
} from '../../../shared/components/ProfileImage';
import { userKeys } from '../../users/api/keys';
import {
  removeProfileImageRequest,
  setProfileImagePresetRequest,
  uploadProfileImageRequest,
} from '../../users/api/mutations';
import { useProfileImagePresetsQuery } from '../../users/api/queries';

interface ProfileImagePickerProps {
  // Current `profile_image_url` from `/me`. `null` → user's on
  // initials. A non-null value either matches one of the presets or
  // is the user's last upload.
  profileImageUrl: string | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

interface ApiErrorShape {
  detail?: string;
  error?: string;
}

// Account / Profile picker — preview + presets grid + upload button
// + Remove. Each mutation invalidates `/me` so the new
// `profile_image_url` propagates to the TopNav avatar + every other
// `<ProfileImage>` surface.
export function ProfileImagePicker({
  profileImageUrl,
  email,
  firstName,
  lastName,
}: ProfileImagePickerProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const { data: presets = [], isLoading: presetsLoading } =
    useProfileImagePresetsQuery();

  function invalidateMe() {
    return queryClient.invalidateQueries({ queryKey: userKeys.me() });
  }

  const setPreset = useMutation({
    mutationFn: (preset_id: string) => setProfileImagePresetRequest(preset_id),
    onSuccess: async () => {
      await invalidateMe();
      setStatus('Profile picture updated.');
    },
    onError: (err: unknown) => {
      const e = err as ApiErrorShape;
      setStatus(e.detail || e.error || 'Failed to update profile picture');
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadProfileImageRequest(file),
    onSuccess: async () => {
      await invalidateMe();
      setStatus('Profile picture uploaded.');
    },
    onError: (err: unknown) => {
      const e = err as ApiErrorShape & { status?: number };
      if (e.status === 413) {
        setStatus('Image is over the 2 MB limit. Try a smaller file.');
      } else {
        setStatus(e.detail || e.error || 'Failed to upload profile picture');
      }
    },
  });

  const remove = useMutation({
    mutationFn: () => removeProfileImageRequest(),
    onSuccess: async () => {
      await invalidateMe();
      setStatus('Profile picture removed.');
    },
    onError: (err: unknown) => {
      const e = err as ApiErrorShape;
      setStatus(e.detail || e.error || 'Failed to remove profile picture');
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(null);
    // `.mutate()` so failures route through `onError` without a
    // dangling unhandled promise.
    upload.mutate(file);
    // Reset so picking the same file twice re-fires onChange.
    e.target.value = '';
  }

  const busy = setPreset.isPending || upload.isPending || remove.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <ProfileImage
          profileImageUrl={profileImageUrl}
          email={email}
          firstName={firstName}
          lastName={lastName}
          sizeClassName="h-20 w-20"
          alt="Profile picture preview"
        />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="btn-primary !w-auto"
            data-testid="profile-image-upload"
          >
            Upload picture
          </button>
          {profileImageUrl && (
            <button
              type="button"
              onClick={() => {
                setStatus(null);
                remove.mutate();
              }}
              disabled={busy}
              className="self-start text-sm font-medium text-rose-700 hover:text-rose-800 disabled:opacity-60 dark:text-rose-300 dark:hover:text-rose-200"
              data-testid="profile-image-remove"
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
          data-testid="profile-image-file"
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
          Or choose a preset
        </h3>
        {presetsLoading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Loading presets…
          </div>
        ) : (
          <div
            className="grid grid-cols-4 gap-3 sm:grid-cols-6"
            data-testid="profile-image-presets"
          >
            {presets.map((preset) => {
              const isActive = profileImageUrl === preset.url;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setStatus(null);
                    setPreset.mutate(preset.id);
                  }}
                  disabled={busy}
                  aria-pressed={isActive}
                  aria-label={`Use preset ${preset.id}`}
                  data-testid={`profile-image-preset-${preset.id}`}
                  className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-full ring-offset-2 transition-shadow disabled:opacity-60 ${
                    isActive
                      ? 'ring-2 ring-indigo-500 ring-offset-white dark:ring-offset-slate-900'
                      : 'ring-1 ring-slate-200 hover:ring-indigo-300 dark:ring-slate-700'
                  }`}
                >
                  <img
                    src={profileImageSrc(preset.url)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {status && (
        <div
          className={
            status.includes('Failed') ||
            status.includes('limit') ||
            status.includes('Try')
              ? 'form-error'
              : 'text-sm font-medium text-emerald-600 dark:text-emerald-400'
          }
          data-testid="profile-image-status"
        >
          {status}
        </div>
      )}
    </div>
  );
}
