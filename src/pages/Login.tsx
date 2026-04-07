import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import BlueRhombusLogo from '@/components/branding/BlueRhombusLogo';
import { useAuth } from '@/auth/AuthContext';

const Login = () => {
  const { isAuthenticated, login, error, clearError } = useAuth();
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setSubmitting(true);

    try {
      await login(token);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background:
          'radial-gradient(circle at 10% 10%, rgba(37,99,235,0.2), transparent 40%), radial-gradient(circle at 90% 80%, rgba(37,99,235,0.12), transparent 50%), var(--ts-bg)',
      }}
    >
      <section
        className="w-full max-w-md p-6 sm:p-8"
        style={{
          backgroundColor: 'var(--ts-surface)',
          border: '1px solid var(--ts-border)',
          borderRadius: '12px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
        }}
      >
        <div className="mb-6 flex items-center justify-between">
          <BlueRhombusLogo withWordmark={false} size={28} />
          <span className="text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--ts-text-muted)' }}>
            B2B Access
          </span>
        </div>

        <h1 className="mono text-xl font-bold mb-2" style={{ color: 'var(--ts-text-primary)' }}>
          TenderSpot
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--ts-text-secondary)' }}>
          Закрытый доступ по invite-токену для команды тендерного отдела.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-xs mb-1" style={{ color: 'var(--ts-text-secondary)' }}>
              Invite token
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Введите токен доступа"
              className="w-full px-3 py-2 text-sm rounded"
              style={{
                backgroundColor: 'var(--ts-bg)',
                border: '1px solid var(--ts-border)',
                color: 'var(--ts-text-primary)',
                outline: 'none',
              }}
              required
            />
          </label>

          {error && (
            <p className="text-xs" style={{ color: '#ef4444' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 text-sm font-medium rounded"
            style={{
              backgroundColor: '#2563EB',
              color: '#ffffff',
              border: '1px solid #2563EB',
              opacity: submitting ? 0.75 : 1,
            }}
          >
            {submitting ? 'Проверяем токен...' : 'Войти'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default Login;
