import { act, renderHook, waitFor } from '@testing-library/react';

import { useLogout } from './useLogout';

const { navigateMock, refetchMock, signOutMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  refetchMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock('react-router', () => ({ useNavigate: () => navigateMock }));
vi.mock('../api/authApi', () => ({ signOut: signOutMock }));
vi.mock('./useSession', () => ({ useSession: () => ({ refetch: refetchMock }) }));

describe('useLogout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refreshes the session before navigating to login', async () => {
    let resolveRefetch!: () => void;
    signOutMock.mockResolvedValue(undefined);
    refetchMock.mockReturnValue(new Promise<void>((resolve) => (resolveRefetch = resolve)));

    const { result } = renderHook(() => useLogout());
    let logout!: Promise<void>;

    act(() => {
      logout = result.current();
    });

    await waitFor(() => expect(refetchMock).toHaveBeenCalledOnce());
    expect(signOutMock).toHaveBeenCalledOnce();
    expect(navigateMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveRefetch();
      await logout;
    });

    expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
    expect(signOutMock.mock.invocationCallOrder[0]).toBeLessThan(
      refetchMock.mock.invocationCallOrder[0]
    );
    expect(refetchMock.mock.invocationCallOrder[0]).toBeLessThan(
      navigateMock.mock.invocationCallOrder[0]
    );
  });
});
