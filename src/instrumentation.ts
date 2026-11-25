export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL && !process.env.VERCEL_ENV) {
    const { startBackgroundBiometricSync } = await import("@/lib/biometric-sync");
    startBackgroundBiometricSync();
  }
}
