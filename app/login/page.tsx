import { login } from './actions'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-8">
        <h1 className="text-xl font-semibold text-white mb-6">Volume Profile</h1>
        <form action={login} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-400" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-400" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="mt-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
