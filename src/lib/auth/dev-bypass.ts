type DevelopmentAuthEnvironment = Readonly<{
  NODE_ENV?: string;
  GRAPH_PIXEL_DEV_AUTH_BYPASS?: string;
  GRAPH_PIXEL_DEV_USER_EMAIL?: string;
}>;

export type DevelopmentAuthBypassConfig = {
  enabled: boolean;
  email: string;
};

export function getDevelopmentAuthBypassConfig(
  defaultEmail: string,
  environment: DevelopmentAuthEnvironment = process.env,
): DevelopmentAuthBypassConfig {
  const enabled =
    environment.NODE_ENV === "development" &&
    environment.GRAPH_PIXEL_DEV_AUTH_BYPASS?.trim().toLowerCase() === "true";
  const email = environment.GRAPH_PIXEL_DEV_USER_EMAIL?.trim().toLowerCase() || defaultEmail;

  return { enabled, email };
}
