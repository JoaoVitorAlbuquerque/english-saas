import { useMutation } from '@tanstack/react-query';

import * as authService from './service';
import type { SigninRequest, SignupRequest } from './schemas';

export function useSignIn() {
  return useMutation({
    mutationFn: (input: SigninRequest) => authService.signin(input),
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: (input: SignupRequest) => authService.signup(input),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => authService.logout(),
  });
}
