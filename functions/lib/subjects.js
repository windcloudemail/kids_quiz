export const SUBJECT_LIST = ['chinese', 'math', 'english']

export function isValidSubject(s) {
  return SUBJECT_LIST.includes(s)
}
