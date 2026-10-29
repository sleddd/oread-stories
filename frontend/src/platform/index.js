// Browser implementations of the things that differ between web and React Native:
// clipboard, saving and opening files, confirmation prompts, local storage and the system colour scheme.
// A native build provides the same functions from this folder.

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function saveTextFile(fileName, text) {
  const blob = new Blob([text], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
}

// Resolves to the chosen file's text, or null when the person cancels.
export function pickTextFile(acceptedType) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = acceptedType;
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    });
    input.click();
  });
}

export function confirmAction(question) {
  return window.confirm(question);
}

export const storage = {
  read(key, fallback = null) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    } catch {
      // Storage can be unavailable (private mode); remembering is only a convenience.
    }
  },
};

export function prefersDarkColorScheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function watchColorScheme(onChange) {
  const query = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!query) {
    return () => {};
  }
  const handleChange = () => onChange(query.matches);
  query.addEventListener("change", handleChange);
  return () => query.removeEventListener("change", handleChange);
}

export function logToConsole(...parts) {
  console.log(...parts);
}
