export const calculateRate = (currentValue: number, total: number) => {
  if (total === 0) {
    return 0;
  }
  if (total - currentValue === 0) {
    return 1;
  }

  return parseFloat((currentValue / (total - currentValue)).toFixed(2));
};
