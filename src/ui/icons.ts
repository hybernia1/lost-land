import iconsUrl from "../assets/icons.svg?url";

export function icon(id: string, label?: string): string {
  const aria = label ? `aria-label="${label}" role="img"` : `aria-hidden="true"`;
  return `<svg class="icon" ${aria}><use href="${iconsUrl}#icon-${id}"></use></svg>`;
}
