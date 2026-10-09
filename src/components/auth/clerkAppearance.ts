import type { ComponentProps } from 'react';
import type { SignIn } from '@clerk/nextjs';

/**
 * Swoop skin for Clerk's <SignIn>/<SignUp>: white ground, royal primary, surface inputs, Figtree,
 * Bricolage title, 10–12px radii, no gradients or card chrome. Clerk's header is the screen's single hero.
 */
type ClerkAppearance = NonNullable<ComponentProps<typeof SignIn>['appearance']>;

const C = {
  royal: '#0055FF',
  royalDark: '#0044CC',
  ink: '#101828',
  surface: '#F2F3F5',
  line: '#EEF0F3',
  slate: '#71717A',
  market: '#C81E1E',
  go: '#15803D'
};

const sans = 'var(--font-figtree), ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
const heading = 'var(--font-bricolage), ui-sans-serif, system-ui, sans-serif';

const input = {
  minHeight: '44px',
  borderRadius: '12px',
  border: '1px solid transparent',
  backgroundColor: C.surface,
  boxShadow: 'none',
  color: C.ink,
  fontSize: '13px',
  fontWeight: 600,
  '&:hover': { borderColor: 'transparent', boxShadow: 'none' },
  '&:focus, &:focus-visible, &[data-focus]': {
    borderColor: C.royal,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 0 0 3px rgb(0 85 255 / 0.12)'
  },
  '&::placeholder': { color: C.slate, fontWeight: 500 }
};

const link = {
  color: C.royal,
  fontWeight: 700,
  '&:hover': { color: C.royalDark, textDecoration: 'none' }
};

export const clerkAppearance: ClerkAppearance = {
  layout: {
    logoPlacement: 'none',
    socialButtonsVariant: 'blockButton',
    socialButtonsPlacement: 'top',
    shimmer: false
  },
  variables: {
    colorPrimary: C.royal,
    colorPrimaryForeground: '#FFFFFF',
    colorForeground: C.ink,
    colorMutedForeground: C.slate,
    colorNeutral: C.ink,
    colorBackground: '#FFFFFF',
    colorInput: C.surface,
    colorInputForeground: C.ink,
    colorDanger: C.market,
    colorSuccess: C.go,
    colorRing: C.royal,
    colorBorder: C.line,
    colorShadow: 'transparent',
    fontFamily: sans,
    fontFamilyButtons: sans,
    fontSize: '13px',
    borderRadius: '10px'
  },
  elements: {
    rootBox: { width: '100%' },
    cardBox: {
      width: '100%',
      maxWidth: '100%',
      border: 'none',
      borderRadius: 0,
      boxShadow: 'none',
      backgroundColor: 'transparent'
    },
    card: {
      gap: '20px',
      padding: 0,
      border: 'none',
      borderRadius: 0,
      boxShadow: 'none',
      backgroundColor: 'transparent'
    },
    header: { alignItems: 'flex-start', textAlign: 'left', gap: '4px' },
    headerTitle: {
      fontFamily: heading,
      fontStretch: '88%',
      fontWeight: 700,
      letterSpacing: '-0.025em',
      fontSize: '20px',
      lineHeight: 1.1,
      color: C.ink
    },
    headerSubtitle: { fontSize: '12.5px', lineHeight: 1.4, color: C.slate },
    socialButtonsBlockButton: {
      minHeight: '44px',
      borderRadius: '12px',
      border: 'none',
      backgroundColor: C.surface,
      boxShadow: 'none',
      color: C.ink,
      '&:hover': { backgroundColor: C.line }
    },
    socialButtonsBlockButtonText: { fontSize: '13px', fontWeight: 700, color: C.ink },
    socialButtonsIconButton: {
      borderRadius: '12px',
      border: 'none',
      backgroundColor: C.surface,
      boxShadow: 'none',
      '&:hover': { backgroundColor: C.line }
    },
    dividerLine: { backgroundColor: C.line },
    dividerText: { fontSize: '11px', fontWeight: 600, color: C.slate },
    formFieldLabel: { fontSize: '11.5px', fontWeight: 700, color: C.ink },
    formFieldHintText: { color: C.slate },
    formFieldInput: input,
    formFieldInputShowPasswordButton: { color: C.slate, '&:hover': { color: C.ink, backgroundColor: 'transparent' } },
    formFieldErrorText: { color: C.market, fontSize: '11.5px' },
    formFieldAction: link,
    otpCodeFieldInput: {
      height: '44px',
      borderRadius: '10px',
      border: '1px solid transparent',
      backgroundColor: C.surface,
      boxShadow: 'none',
      color: C.ink,
      fontWeight: 700,
      '&:focus, &[data-focus]': { borderColor: C.royal, backgroundColor: '#FFFFFF' }
    },
    formButtonPrimary: {
      height: '48px',
      borderRadius: '12px',
      border: 'none',
      backgroundColor: C.royal,
      backgroundImage: 'none',
      boxShadow: 'none',
      color: '#FFFFFF',
      fontSize: '14px',
      fontWeight: 700,
      textTransform: 'none',
      '&::after': { display: 'none' },
      '&:hover, &:focus': { backgroundColor: C.royalDark, boxShadow: 'none' },
      '&:focus-visible': { boxShadow: '0 0 0 3px rgb(0 85 255 / 0.25)' }
    },
    formButtonReset: link,
    formResendCodeLink: link,
    footer: {
      background: 'transparent',
      backgroundImage: 'none',
      borderTop: 'none',
      marginTop: '4px'
    },
    footerAction: { justifyContent: 'flex-start', paddingLeft: 0, paddingRight: 0 },
    footerActionText: { fontSize: '12px', color: C.slate },
    footerActionLink: link,
    identityPreview: { borderRadius: '12px', border: 'none', backgroundColor: C.surface },
    identityPreviewText: { color: C.ink, fontWeight: 600 },
    identityPreviewEditButton: { color: C.royal },
    alternativeMethodsBlockButton: {
      minHeight: '44px',
      borderRadius: '12px',
      border: 'none',
      backgroundColor: C.surface,
      boxShadow: 'none',
      color: C.ink,
      '&:hover': { backgroundColor: C.line }
    },
    backLink: link,
    alert: { borderRadius: '12px', border: 'none' }
  }
};
