/**
 * Where the community server lives for this build.
 *
 * One constant rather than the same ternary in each service, because it is not only services that need
 * it: an avatar and a thumbnail are absolute URLs built against this base, and the components that draw
 * them were reaching into `WorldStorageService` for it — pulling the whole world store, and everything
 * it migrates, into any bundle that renders a face.
 */
export const API_BASE_URL: string = import.meta.env.MODE === 'production'
  ? import.meta.env.VITE_API_URL_PROD
  : import.meta.env.VITE_API_URL_DEV;
