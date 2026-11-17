// Chrome loads content scripts as classic scripts, which cannot use `import`
// statements. This stub's only job is to load the real, modular entry point.
import(chrome.runtime.getURL('src/content/main.js'));
