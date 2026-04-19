import { useNavigate } from 'react-router-dom'

/**
 * @param {{ onSignIn?: () => void }} props
 */
export default function Login({ onSignIn }) {
  const navigate = useNavigate()

  function handleSubmit(e) {
    e.preventDefault()
    onSignIn?.()
    navigate('/home')
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <section
        className="si-login-hero relative flex flex-col justify-center overflow-hidden px-8 py-12 text-white lg:w-1/2 lg:px-14 lg:py-16"
        aria-labelledby="login-brand-heading"
      >
        <div
          className="si-login-hero-grid pointer-events-none absolute inset-0 z-0 opacity-[0.08]"
          aria-hidden
        />
        <div
          className="si-login-hero-glow pointer-events-none absolute -right-24 -top-24 z-[1] h-64 w-64 rounded-full opacity-20 blur-3xl"
          aria-hidden
        />
        <div className="relative z-10 max-w-lg">
          <p className="si-accent mb-3 text-sm font-semibold uppercase tracking-widest">
          
          </p>
          <h1
            id="login-brand-heading"
            className="si-accent mb-3 text-2xl font-semibold uppercase tracking-normal">
              
          
            Smart Inventory
          </h1>
      
     
        </div>
      </section>

      <section
        className="si-login-aside relative flex flex-1 flex-col items-center justify-center px-6 py-16 sm:px-10 sm:py-20 lg:w-1/2 lg:px-16 lg:py-24"
        aria-labelledby="login-form-heading"
      >
        <div
          className="si-login-aside-deco pointer-events-none absolute inset-0 opacity-[0.35]"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-md">
          <p className="si-eyebrow text-sm font-semibold uppercase tracking-widest lg:hidden">
            Sign in
          </p>
          <h2
            id="login-form-heading"
            className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-[2rem] lg:mt-0 lg:text-4xl lg:leading-tight"
          >
            <span className="lg:hidden">Welcome back</span>
            <span className="hidden lg:inline">Sign in to continue</span>
          </h2>
          <p className="mt-3 hidden text-base leading-relaxed text-slate-600/70 lg:block">
            Use your organization credentials to open the dashboard.
          </p>

          <form
            onSubmit={handleSubmit}
            className="si-card si-card--login space-y-7"
          >
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="si-input rounded-xl"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <button type="button" className="si-btn si-btn--ghost">
                  Forgot password?
                </button>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="si-input rounded-xl"
                placeholder="Enter your password"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                className="si-checkbox"
              />
              <label
                htmlFor="remember"
                className="text-sm text-slate-600/75"
              >
                Keep me signed in on this device
              </label>
            </div>
            <button type="submit" className="si-btn si-btn--primary">
              Sign in
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-500/80">
            By signing in you agree to internal data handling policies.
          </p>
        </div>
      </section>
    </div>
  )
}
