// Pops a transient `<input type="file">` programmatically. Unlike the file
// input owned by the TopBar, this helper requires no DOM coordinates and can
// be triggered from any user-gesture context (e.g. a keyboard shortcut). The
// File System Access API (showOpenFilePicker) is Chromium-only; this fallback
// works in every browser. Resolves with the picked File or undefined if the
// user cancels.
export const openFilePicker = (accept = "application/json,.json"): Promise<File | undefined> =>
  new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    let resolved = false;
    const finish = (file: File | undefined): void => {
      if (resolved) return;
      resolved = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener("change", () => finish(input.files?.[0]));
    input.addEventListener("cancel", () => finish(undefined));
    input.style.display = "none";
    document.body.appendChild(input);
    input.click();
  });
