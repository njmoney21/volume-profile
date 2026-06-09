import { describe, it, expect } from 'vitest'

function resolveRoute(isAuthenticated: boolean, pathname: string): string {
  if (!isAuthenticated && pathname !== '/login') return 'redirect:/login'
  if (isAuthenticated && pathname === '/login') return 'redirect:/journal'
  return 'allow'
}

describe('auth routing', () => {
  it('redirects unauthenticated user from /journal to /login', () => {
    expect(resolveRoute(false, '/journal')).toBe('redirect:/login')
  })

  it('redirects unauthenticated user from / to /login', () => {
    expect(resolveRoute(false, '/')).toBe('redirect:/login')
  })

  it('allows authenticated user to access /journal', () => {
    expect(resolveRoute(true, '/journal')).toBe('allow')
  })

  it('redirects authenticated user away from /login to /journal', () => {
    expect(resolveRoute(true, '/login')).toBe('redirect:/journal')
  })

  it('allows unauthenticated user to stay on /login', () => {
    expect(resolveRoute(false, '/login')).toBe('allow')
  })
})
