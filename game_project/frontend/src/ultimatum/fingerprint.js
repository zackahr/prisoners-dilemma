/* utils/fingerprint.js */
export function getOrCreateFingerprint() {
  let fp = localStorage.getItem("ult_fp");
  if (!fp) {
    fp = "fp_" + Math.random().toString(36).slice(2);
    localStorage.setItem("ult_fp", fp);
  }
  return fp;
}
