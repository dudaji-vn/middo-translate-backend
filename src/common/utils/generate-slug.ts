const randomString = () => Math.random().toString(36).substr(2, 3);
export const generateSlug = () => {
  return `${randomString()}-${randomString()}-${randomString()}`;
};
