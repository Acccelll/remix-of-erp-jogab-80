/**
 * RichTextEditor — Fase E (Quadros).
 *
 * Tiptap (StarterKit + Link + Placeholder) com `tiptap-markdown` para
 * serializar/desserializar em **markdown**. Mantém a portabilidade com o
 * conteúdo atual (descrições e comentários hoje já são markdown e renderizados
 * por `MarkdownView`). Sem HTML cru: o schema do Tiptap sanitiza a entrada.
 *
 * Props:
 *   - value:        markdown atual
 *   - onChange:     novo markdown
 *   - placeholder:  texto vazio
 *   - minHeight:    altura mínima do editor (px)
 *   - autoFocus:    foco ao montar
 */
import { useEffect, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Undo2,
  Redo2,
} from "lucide-react";

type Props = {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: number;
  autoFocus?: boolean;
  className?: string;
};

function ToolbarBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className="h-7 w-7"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={!!active}
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor, onAbrirLink }: { editor: Editor; onAbrirLink: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1 bg-muted/30">
      <ToolbarBtn
        title="Negrito (Ctrl+B)"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Itálico (Ctrl+I)"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Tachado"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Código inline"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolbarBtn
        title="Título 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Título 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolbarBtn
        title="Lista"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Lista numerada"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Citação"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Link" active={editor.isActive("link")} onClick={onAbrirLink}>
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarBtn>
      <span className="ml-auto flex items-center gap-0.5">
        <ToolbarBtn
          title="Desfazer"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Refazer"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </span>
    </div>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 120,
  autoFocus,
  className,
}: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Escreva…" }),
      Markdown.configure({
        html: false,
        breaks: true,
        linkify: true,
        transformPastedText: true,
      }),
    ],
    content: value ?? "",
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none px-3 py-2",
          "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_a]:text-primary [&_a]:underline",
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      // tiptap-markdown adiciona storage.markdown.getMarkdown()
      const md = (ed.storage as any).markdown?.getMarkdown?.() ?? "";
      onChange(md);
    },
  });

  // Sincroniza quando `value` muda externamente (ex.: cancelar edição).
  useEffect(() => {
    if (!editor) return;
    const current = (editor.storage as any).markdown?.getMarkdown?.() ?? "";
    if ((value ?? "") !== current) {
      editor.commands.setContent(value ?? "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return (
      <div className={cn("rounded-md border bg-background", className)} style={{ minHeight }} />
    );
  }

  const abrirLink = () => {
    setLinkUrl((editor.getAttributes("link").href as string) ?? "");
    setLinkOpen(true);
  };
  const aplicarLink = () => {
    const url = linkUrl.trim();
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkOpen(false);
  };
  const removerLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  };

  return (
    <div
      className={cn(
        "rounded-md border bg-background overflow-hidden",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        className,
      )}
    >
      <Toolbar editor={editor} onAbrirLink={abrirLink} />
      <div style={{ minHeight }} className="text-sm">
        <EditorContent editor={editor} />
      </div>
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Link</DialogTitle>
            <DialogDescription>
              Cole ou edite a URL. Deixe em branco para remover.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                aplicarLink();
              }
            }}
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>
              Cancelar
            </Button>
            {editor.isActive("link") && (
              <Button variant="outline" onClick={removerLink}>
                Remover
              </Button>
            )}
            <Button onClick={aplicarLink}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
