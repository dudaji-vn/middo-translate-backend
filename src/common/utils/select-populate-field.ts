export function selectPopulateField<T>(keys: (keyof T)[]): string {
  return keys.join(' ');
}
