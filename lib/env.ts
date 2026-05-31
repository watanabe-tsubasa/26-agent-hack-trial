export type AppEnv = 'local' | 'staging' | 'production';

export function getAppEnv(): AppEnv {
  const appEnv = process.env.APP_ENV;

  if (appEnv === 'local' || appEnv === 'staging' || appEnv === 'production') {
    return appEnv;
  }

  throw new Error(`Invalid APP_ENV: ${appEnv}`);
}