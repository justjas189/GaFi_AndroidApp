/**
 * Automatic user-type filtering from the sign-up email (panel revision).
 *
 * School-issued Microsoft/Outlook addresses identify students (and faculty)
 * by their domain. Matching is suffix-based and case-insensitive, first rule
 * wins — put the most specific suffixes first.
 *
 * Add your school's real domains here. If students and teachers/staff use
 * different subdomains or address patterns, encode that with two rules, e.g.:
 *   { suffix: '@students.school.edu.ph', userType: 'student' },
 *   { suffix: '@school.edu.ph',          userType: 'employee' }, // faculty/staff
 */
const SCHOOL_DOMAIN_RULES = [
  { suffix: '@mcl.edu.ph', userType: 'employee' },
  { suffix: '@live.mcl.edu.ph', userType: 'student' },
];

/**
 * @param {string} email
 * @returns {'student'|'employee'|null} detected type, or null when the email
 *   doesn't match any school rule (user picks manually).
 */
export const detectUserTypeFromEmail = (email) => {
  if (!email || typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes('@')) return null;
  const rule = SCHOOL_DOMAIN_RULES.find((r) => normalized.endsWith(r.suffix));
  return rule ? rule.userType : null;
};

export default detectUserTypeFromEmail;
