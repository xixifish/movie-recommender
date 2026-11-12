// Safely returns an array from localstorage.getItem()
export function readSavedIds(rawValue) {
  let ids;
  try {
    ids = JSON.parse(rawValue);
  } catch (err) {
    console.warn(err.message);
    return [];
  }

  if (!Array.isArray(ids)) return [];

  return ids.filter(Number.isInteger);
}

// Safely returns the value from localStorage
export function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn("Can't read storage", err.message);
    return null;
  }
}

// Safely writes key and value to localStorage
export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn("Can't write storage: ", err.message);
  }
}
