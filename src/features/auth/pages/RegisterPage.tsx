import { useNavigate } from 'react-router-dom';

import { RegisterForm } from '../components/RegisterForm';

// Thin page wrapper around <RegisterForm />. The form body is shared
// with the RegisterModal on Home — see CONTRIBUTING.md §6
// "Modal pattern" for the hybrid-auth rationale. The form itself
// renders the "Already have an account? Login" prompt; no extra
// footer is needed here.
export function RegisterPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto my-10 max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
        Register
      </h1>
      <RegisterForm onSwitchToLogin={() => navigate('/login')} />
    </div>
  );
}
