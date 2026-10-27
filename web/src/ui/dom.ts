function keyOf(node: Node): string {
  if (!(node instanceof Element)) return `${node.nodeType}:${node.textContent ?? ''}`
  const attributes = ['id', 'data-id', 'data-route', 'data-action', 'data-qty', 'data-change', 'data-project', 'data-slot', 'data-equipment']
    .map((name) => node.getAttribute(name) ?? '')
    .join(':')
  return `${node.nodeName}:${attributes}`
}

function sameKind(target: Node, source: Node): boolean {
  if (target.nodeType !== source.nodeType) return false
  if (!(target instanceof Element) || !(source instanceof Element)) return target.nodeName === source.nodeName
  return target.nodeName === source.nodeName && keyOf(target) === keyOf(source)
}

function patchAttributes(target: Element, source: Element): void {
  for (const attribute of [...target.attributes]) {
    if (source.getAttribute(attribute.name) !== attribute.value) target.removeAttribute(attribute.name)
  }
  for (const attribute of [...source.attributes]) {
    if (target.getAttribute(attribute.name) !== attribute.value) target.setAttribute(attribute.name, attribute.value)
  }
}

function patchNode(target: Node, source: Node): void {
  if (!(target instanceof Element) || !(source instanceof Element)) {
    if (target.textContent !== source.textContent) target.textContent = source.textContent
    return
  }
  patchAttributes(target, source)
  patchChildren(target, source)
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    if (document.activeElement !== target && 'value' in source) {
      const sourceValue = String((source as HTMLInputElement).value)
      if (target.value !== sourceValue) target.value = sourceValue
    }
    if (source instanceof HTMLInputElement && target instanceof HTMLInputElement && target.checked !== source.checked && document.activeElement !== target) {
      target.checked = source.checked
    }
  }
}

function patchChildren(target: Element, source: Element): void {
  const current = [...target.childNodes]
  const used = new Set<Node>()
  let cursor: Node | null = target.firstChild
  for (const sourceNode of source.childNodes) {
    const match = current.find((node) => !used.has(node) && sameKind(node, sourceNode))
    if (!match) {
      target.insertBefore(sourceNode.cloneNode(true), cursor)
      continue
    }
    used.add(match)
    if (match === cursor) {
      cursor = cursor?.nextSibling ?? null
    } else {
      target.insertBefore(match, cursor)
    }
    patchNode(match, sourceNode)
  }
  for (const node of current) if (!used.has(node)) node.remove()
}

export function patchDom(target: Element, source: Element): void {
  patchNode(target, source)
}
