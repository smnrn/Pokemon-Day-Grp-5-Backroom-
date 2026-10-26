import type { Root } from "react-dom/client"

type RootScope = typeof globalThis & {
  __silphReactRoots?: WeakMap<HTMLElement, Root>
}

export function getAppRoot(
  container: HTMLElement,
  create: (container: HTMLElement) => Root,
): Root {
  // Preview/HMR can re-evaluate both the entrypoint and this module. Keep root
  // ownership outside module scope, keyed by the actual DOM container.
  const scope = globalThis as RootScope
  const roots = (scope.__silphReactRoots ??= new WeakMap<HTMLElement, Root>())
  let root = roots.get(container)
  if (!root) {
    root = create(container)
    roots.set(container, root)
  }
  return root
}
