export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackgroundBiometricSync } = await import("@/lib/biometric-sync");
    startBackgroundBiometricSync();
  }
}
