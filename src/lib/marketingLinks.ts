const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

export const getMarketingUrl = (path: string = "/") => {
  const baseUrl = import.meta.env.VITE_MARKETING_URL as string | undefined;
  const normalized = normalizePath(path);
  return baseUrl ? `${baseUrl}${normalized}` : normalized;
};
