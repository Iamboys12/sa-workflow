import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createBrowserSupabase } from '@/lib/supabase/client'
import LoginPage from '../page'

jest.mock('@/lib/supabase/client', () => ({
  createBrowserSupabase: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))

const mockCreateBrowserSupabase = createBrowserSupabase as jest.Mock

describe('LoginPage', () => {
  beforeEach(() => {
    mockCreateBrowserSupabase.mockReturnValue({
      auth: { signInWithPassword: jest.fn().mockResolvedValue({ error: null }) },
    })
  })

  it('renders email and password fields', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('calls signInWithPassword with form values on submit', async () => {
    const mockSignIn = jest.fn().mockResolvedValue({ error: null })
    mockCreateBrowserSupabase.mockReturnValue({ auth: { signInWithPassword: mockSignIn } })

    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'sa@test.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'sa@test.com',
        password: 'password123',
      })
    })
  })

  it('shows error message on failed login', async () => {
    mockCreateBrowserSupabase.mockReturnValue({
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          error: { message: 'Invalid credentials' },
        }),
      },
    })

    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bad@test.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })
})
