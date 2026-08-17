/**
 * MarkdownView — REF.4 (markdown nas descrições/comentários).
 * Renderer GFM (listas, tabelas, checkboxes, links). Estilo Tailwind
 * Typography custom (sem plugin), compacto para uso embarcado no Dialog.
 */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export default function MarkdownView({
  source,
  className,
}: {
  source: string | null | undefined;
  className?: string;
}) {
  const txt = (source ?? "").trim();
  if (!txt) {
    return <span className="text-xs text-muted-foreground italic">Sem conteúdo</span>;
  }
  return (
    <div
      className={cn(
        "text-sm leading-relaxed",
        "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1",
        "[&_li]:my-0.5",
        "[&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-2 [&_h1]:mb-1",
        "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1",
        "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-1 [&_h3]:mb-0.5",
        "[&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-muted [&_code]:text-[0.85em]",
        "[&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-auto [&_pre]:my-1",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_a]:text-primary [&_a]:underline hover:[&_a]:opacity-80",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-2 [&_blockquote]:text-muted-foreground",
        "[&_table]:text-xs [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:px-1.5 [&_td]:px-1.5 [&_th]:py-0.5 [&_td]:py-0.5",
        "[&_hr]:my-2 [&_hr]:border-border",
        "break-words",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {txt}
      </ReactMarkdown>
    </div>
  );
}
