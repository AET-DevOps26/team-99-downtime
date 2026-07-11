import { act, renderHook } from '@testing-library/react';
import { toast } from 'sonner';

import { useLogout } from './useLogout';

const { replaceMock, signOutMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('../api/authApi', () => ({ signOut: signOutMock }));

describe('useLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('location', { replace: replaceMock });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('replaces the document with the login route after signing out', async () => {
    signOutMock.mockResolvedValue({ data: { success: true }, error: null });

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current();
    });

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(replaceMock).toHaveBeenCalledWith('/login');
    expect(signOutMock.mock.invocationCallOrder[0]).toBeLessThan(
      replaceMock.mock.invocationCallOrder[0]
    );
  });

  it('shows an error and stays put when sign-out fails', async () => {
    signOutMock.mockResolvedValue({
      data: null,
      error: { message: 'Auth service unavailable' },
    });

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current();
    });

    expect(toast.error).toHaveBeenCalledWith('Auth service unavailable');
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
