// src/theme/typography.js
// Central typography tokens for GaFi. Strings + style presets only — no native
// font modules imported here, so this is safe to import from any file (even
// module-scope StyleSheet.create). Family strings MUST match the names
// registered by useFonts in src/hooks/useAppFonts.js.
//
// Streamlined two-superfamily system:
//   Sora  -> brand + headings (geometric, techy, premium)
//   Inter -> body, UI, numbers

export const FONTS = {
  // Brand / logo
  brand:           'Sora_700Bold',

  // Headings
  headingBold:     'Sora_700Bold',
  headingSemiBold: 'Sora_600SemiBold',

  // Body / UI
  bodyRegular:     'Inter_400Regular',
  bodyMedium:      'Inter_500Medium',
  bodySemiBold:    'Inter_600SemiBold',
  bodyBold:        'Inter_700Bold',   // emphasis on UI text (e.g. active tab) — avoids fontWeight+family synth-bold

  // Numbers / currency
  numberSemiBold:  'Inter_600SemiBold',
  numberBold:      'Inter_700Bold',
};

// tabular-nums = every digit same width → numbers stop jiggling as they change.
// iOS: rock solid. Android (RN 0.81): honored for fonts shipping the `tnum`
// OpenType feature — Inter does. Cheap layout insurance, keep it on numbers.
const TABULAR = ['tabular-nums'];

// Ready-to-spread presets. The premium feel is the scale + tracking, not just
// the families: headings get slightly negative letterSpacing; numbers get
// tabular figures + tight tracking so dashboards stay rock-steady.
export const TYPOGRAPHY = {
  brand:       { fontFamily: FONTS.brand,           fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },

  h1:          { fontFamily: FONTS.headingBold,     fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  h2:          { fontFamily: FONTS.headingBold,     fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  h3:          { fontFamily: FONTS.headingSemiBold, fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },

  body:        { fontFamily: FONTS.bodyRegular,     fontSize: 15, lineHeight: 22 },
  bodyStrong:  { fontFamily: FONTS.bodySemiBold,    fontSize: 15, lineHeight: 22 },
  label:       { fontFamily: FONTS.bodyMedium,      fontSize: 13, lineHeight: 18 },
  caption:     { fontFamily: FONTS.bodyRegular,     fontSize: 12, lineHeight: 16 },

  numberLarge: { fontFamily: FONTS.numberBold,      fontSize: 28, lineHeight: 32, letterSpacing: -0.5, fontVariant: TABULAR },
  number:      { fontFamily: FONTS.numberSemiBold,  fontSize: 18, lineHeight: 22, letterSpacing: -0.2, fontVariant: TABULAR },
  numberSmall: { fontFamily: FONTS.numberSemiBold,  fontSize: 13, lineHeight: 16,                      fontVariant: TABULAR },
};
