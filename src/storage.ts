import { emptyData, validate, type Data } from "./model";
export const KEY = "savings.app.v1",
  PREVIOUS = KEY + ".previous";
export interface Loaded {
  data: Data;
  error: string;
  raw: string | null;
}
export function load(): Loaded {
  try {
    const raw = localStorage.getItem(KEY);
    return {
      data: raw ? validate(JSON.parse(raw)) : emptyData(),
      error: "",
      raw,
    };
  } catch (e) {
    return {
      data: emptyData(),
      error:
        "Your saved data could not be opened. It has been preserved. Restore a backup or download the original for recovery.",
      raw: null,
    };
  }
}
export function save(data: Data, expectedRevision: number, replace = false) {
  const current = localStorage.getItem(KEY);
  if (
    !replace &&
    current &&
    validate(JSON.parse(current)).revision !== expectedRevision
  )
    throw Error(
      "This app changed in another tab. Reload to use the latest data.",
    );
  const next = validate({ ...data, revision: expectedRevision + 1 });
  if (current) localStorage.setItem(PREVIOUS, current);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
export function download(
  content: string,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
