// Local mode: one person on their own machine, no login. Every request uses the same services,
// built once on the local file store.
export function createLocalTenancy(services) {
  return {
    services,
    requiresSignIn: false,
    isAuthRequest: () => false,
    handleAuth: async () => {},
    servicesFor: async () => services,
  };
}
