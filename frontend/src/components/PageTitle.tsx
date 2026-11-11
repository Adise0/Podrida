// React 19 hoists <title> into the document head.
export function PageTitle({ children }: { children: string }) {
  return <title>{`${children} · Podrida`}</title>;
}
