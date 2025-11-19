/**
 * UUID generator that works in both Node.js and browser environments
 */

let generateUUID: () => string;

// Check if we're in Node.js environment
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  // Node.js environment - use crypto module
  try {
    const { randomUUID } = require('crypto');
    generateUUID = randomUUID;
  } catch {
    // Fallback if crypto is not available
    generateUUID = fallbackUUID;
  }
} else {
  // Browser environment - use Web Crypto API or fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    generateUUID = () => crypto.randomUUID();
  } else {
    generateUUID = fallbackUUID;
  }
}

/**
 * Fallback UUID v4 generator
 */
function fallbackUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export { generateUUID as randomUUID };
