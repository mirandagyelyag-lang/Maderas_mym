export async function lockVelvetPortrait() {
  try {
    if (window.matchMedia?.("(display-mode: standalone)")?.matches && screen.orientation?.lock) {
      await screen.orientation.lock("portrait-primary");
    }
  } catch {
    // Some browsers only honor the manifest orientation.
  }
}
