export interface NormalizedBase {
  prefix: string;
  withoutTrailingSlash: string;
}

export function normalizeBase(base: string = import.meta.env.BASE_URL ?? "/"): NormalizedBase {
  let normalized = (base || "/").trim();
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (!normalized.endsWith("/")) {
    normalized = `${normalized}/`;
  }
  return {
    prefix: normalized,
    withoutTrailingSlash: normalized === "/" ? "" : normalized.slice(0, -1)
  };
}

export function appPath(
  pathname: string = typeof location !== "undefined" ? location.pathname : "/",
  base: string = import.meta.env.BASE_URL ?? "/"
): string {
  const { prefix, withoutTrailingSlash } = normalizeBase(base);
  let path = pathname;
  if (withoutTrailingSlash && (path === withoutTrailingSlash || path.startsWith(prefix))) {
    path = path.slice(withoutTrailingSlash.length);
  }
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  return path || "/";
}

export function appUrl(
  path: string,
  base: string = import.meta.env.BASE_URL ?? "/"
): string {
  if (path && /^(?:[a-z]+:|\/\/|#)/i.test(path)) {
    return path;
  }
  const { prefix, withoutTrailingSlash } = normalizeBase(base);
  if (!path || path === "/" || path === prefix || path === withoutTrailingSlash) {
    return prefix;
  }
  if (!withoutTrailingSlash) {
    let clean = path.startsWith("./") ? path.slice(2) : path;
    if (!clean.startsWith("/")) clean = `/${clean}`;
    return clean;
  }
  if (path.startsWith(prefix)) {
    return path;
  }
  if (path.startsWith(`${withoutTrailingSlash}?`) || path.startsWith(`${withoutTrailingSlash}#`)) {
    return path;
  }
  let clean = path.startsWith("./") ? path.slice(2) : path;
  if (!clean.startsWith("/")) {
    clean = `/${clean}`;
  }
  return `${withoutTrailingSlash}${clean}`;
}

export function assetUrl(
  path: string,
  base: string = import.meta.env.BASE_URL ?? "/"
): string {
  return appUrl(path, base);
}

export function normalizeAppLinks(
  root: ParentNode = document,
  base: string = import.meta.env.BASE_URL ?? "/"
): void {
  root.querySelectorAll<HTMLAnchorElement>("a[data-link]").forEach((link) => {
    const raw = link.getAttribute("href");
    if (raw && !/^(?:[a-z]+:|\/\/|#)/i.test(raw)) {
      const normalized = appUrl(raw, base);
      if (raw !== normalized) {
        link.setAttribute("href", normalized);
      }
    }
  });

  root.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    const raw = image.getAttribute("src");
    if (raw && !/^(?:[a-z]+:|\/\/|data:)/i.test(raw)) {
      const normalized = assetUrl(raw, base);
      if (raw !== normalized) {
        image.setAttribute("src", normalized);
      }
    }
  });
}
