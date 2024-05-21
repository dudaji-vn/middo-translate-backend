export const calculateRate = (currentValue: number, total: number) => {
  if (total === 0) {
    return 0;
  }
  if (total - currentValue === 0) {
    return 100;
  }

  return Math.round((currentValue * 100) / (total - currentValue));
};
