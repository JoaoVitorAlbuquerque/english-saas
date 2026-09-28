import { useSigninWithGoogle } from '@english-saas/api-client';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuthStore } from '../../../stores/auth-store';

export function useGoogleCallbackController() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const signinWithGoogle = useSigninWithGoogle();
  const attempted = useRef(false);

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const isDenied = searchParams.get('error') !== null || !code || !state;

  useEffect(() => {
    if (attempted.current || isDenied || !code || !state) {
      return;
    }

    attempted.current = true;

    signinWithGoogle
      .mutateAsync({ code, state })
      .then((session) => {
        setSession(session.user);
        navigate('/', { replace: true });
      })
      .catch(() => {
        // erro exibido via signinWithGoogle.error
      });
  }, [code, state, isDenied, signinWithGoogle, setSession, navigate]);

  return {
    isDenied,
    isError: signinWithGoogle.isError,
    errorMessage: signinWithGoogle.error?.message,
  };
}
