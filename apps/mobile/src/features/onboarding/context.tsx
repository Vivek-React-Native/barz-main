import { createContext } from 'react';

export type OnboardingContextData =
  | { mode: null }
  | { mode: 'SIGN_UP'; rawPhoneNumber: string }
  | { mode: 'SIGN_IN'; rawPhoneNumber: string; phoneNumberId: string };

export const EMPTY_CONTEXT_DATA: OnboardingContextData = {
  mode: null,
};

const OnboardingContext = createContext<{
  onboardingContextData: OnboardingContextData;
  setOnboardingContextData: (
    updater: (old: OnboardingContextData) => OnboardingContextData,
  ) => void;
}>({
  onboardingContextData: EMPTY_CONTEXT_DATA,
  setOnboardingContextData: () => {},
});

export default OnboardingContext;
