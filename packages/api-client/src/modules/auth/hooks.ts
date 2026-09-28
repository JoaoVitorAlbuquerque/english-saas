import { useMutation } from '@tanstack/react-query';

import type { ApiError } from '../../http/api-error';
import * as authService from './service';
import type {
  ForgotPasswordRequest,
  GoogleCallbackRequest,
  GoogleUrlResponse,
  ResendVerificationRequest,
  ResetPasswordRequest,
  SessionResponse,
  SigninRequest,
  SignupRequest,
  VerifyEmailRequest,
} from './schemas';

export function useSignIn() {
  return useMutation<SessionResponse, ApiError, SigninRequest>({
    mutationFn: (input) => authService.signin(input),
  });
}

export function useSignUp() {
  return useMutation<SessionResponse, ApiError, SignupRequest>({
    mutationFn: (input) => authService.signup(input),
  });
}

export function useLogout() {
  return useMutation<void, ApiError, void>({
    mutationFn: () => authService.logout(),
  });
}

export function useForgotPassword() {
  return useMutation<void, ApiError, ForgotPasswordRequest>({
    mutationFn: (input) => authService.forgotPassword(input),
  });
}

export function useResetPassword() {
  return useMutation<void, ApiError, ResetPasswordRequest>({
    mutationFn: (input) => authService.resetPassword(input),
  });
}

export function useVerifyEmail() {
  return useMutation<void, ApiError, VerifyEmailRequest>({
    mutationFn: (input) => authService.verifyEmail(input),
  });
}

export function useResendVerification() {
  return useMutation<void, ApiError, ResendVerificationRequest>({
    mutationFn: (input) => authService.resendVerification(input),
  });
}

export function useGoogleUrl() {
  return useMutation<GoogleUrlResponse, ApiError, void>({
    mutationFn: () => authService.getGoogleUrl(),
  });
}

export function useSigninWithGoogle() {
  return useMutation<SessionResponse, ApiError, GoogleCallbackRequest>({
    mutationFn: (input) => authService.signinWithGoogle(input),
  });
}
