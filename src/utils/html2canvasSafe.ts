import type { Options } from 'html2canvas';

function resolveColorToRgb(doc: Document, colorValue: string): string | null {
  const probe = doc.createElement('span');
  probe.style.position = 'fixed';
  probe.style.left = '-99999px';
  probe.style.top = '-99999px';
  probe.style.color = colorValue;
  doc.body.appendChild(probe);
  const computed = doc.defaultView?.getComputedStyle(probe).color?.trim() ?? '';
  probe.remove();

  if (!computed || computed.includes('oklch(')) {
    return null;
  }

  return computed;
}

function replaceOklchFunctions(input: string, doc: Document): string {
  if (!input.includes('oklch(')) return input;
  return input.replace(/oklch\([^)]*\)/g, (match) => resolveColorToRgb(doc, match) ?? match);
}

function buildRootVariableOverrides(doc: Document): string {
  const computed = doc.defaultView?.getComputedStyle(doc.documentElement);
  if (!computed) return '';

  const overrides: string[] = [];
  for (let i = 0; i < computed.length; i += 1) {
    const name = computed[i];
    if (!name.startsWith('--')) continue;
    const value = computed.getPropertyValue(name).trim();
    if (!value || !value.includes('oklch(')) continue;
    const rgb = resolveColorToRgb(doc, value);
    if (rgb) overrides.push(`${name}:${rgb};`);
  }

  return overrides.join('');
}

export function withHtml2CanvasColorFix(baseOptions: Partial<Options> = {}): Partial<Options> {
  const userOnClone = baseOptions.onclone;

  return {
    ...baseOptions,
    onclone: (clonedDoc) => {
      const rootVarOverrides = buildRootVariableOverrides(clonedDoc);
      if (rootVarOverrides) {
        const overrideStyle = clonedDoc.createElement('style');
        overrideStyle.setAttribute('data-html2canvas-safe-colors', 'true');
        overrideStyle.textContent = `:root{${rootVarOverrides}}`;
        clonedDoc.head.appendChild(overrideStyle);
      }

      const styleTags = Array.from(clonedDoc.querySelectorAll('style'));
      styleTags.forEach((styleTag) => {
        const css = styleTag.textContent;
        if (!css || !css.includes('oklch(')) return;
        styleTag.textContent = replaceOklchFunctions(css, clonedDoc);
      });

      const styledNodes = Array.from(clonedDoc.querySelectorAll<HTMLElement>('[style]'));
      styledNodes.forEach((node) => {
        const inlineStyle = node.getAttribute('style');
        if (!inlineStyle || !inlineStyle.includes('oklch(')) return;
        node.setAttribute('style', replaceOklchFunctions(inlineStyle, clonedDoc));
      });

      userOnClone?.(clonedDoc, clonedDoc.body as HTMLElement);
    },
  };
}
