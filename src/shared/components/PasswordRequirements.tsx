import { validatePassword } from '../utils/validation';

interface PasswordRequirementsProps {
  password: string | null | undefined;
}

interface RequirementRowProps {
  met: boolean;
  text: string;
}

function Requirement({ met, text }: RequirementRowProps) {
  return (
    <div
      className={
        'flex items-center gap-2 text-sm transition-colors ' +
        (met
          ? 'text-success-600 dark:text-success-400'
          : 'text-slate-500 dark:text-slate-400')
      }
    >
      <span aria-hidden="true" className="text-base leading-none">
        {met ? '✓' : '○'}
      </span>
      <span>{text}</span>
    </div>
  );
}

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  if (!password) return null;

  const { length, uppercase, lowercase, digit, special } =
    validatePassword(password);

  return (
    <div className="mt-2 flex flex-col gap-1 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
        Password must have:
      </p>
      <Requirement met={length} text="8-64 characters" />
      <Requirement met={uppercase} text="At least one uppercase letter" />
      <Requirement met={lowercase} text="At least one lowercase letter" />
      <Requirement met={digit} text="At least one number" />
      <Requirement met={special} text="At least one special character" />
    </div>
  );
}
