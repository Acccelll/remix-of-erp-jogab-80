/**
 * CommentEditor — Fase H2 (Quadros).
 *
 * Editor rico para comentários de card: Tiptap com Markdown, Mention `@login`
 * (inserindo texto puro para o `extrairMencoes` existente continuar valendo)
 * e Image (upload via bucket `card-anexos`, com drag-and-drop, paste e botão
 * na toolbar). Atalho Ctrl/Cmd+Enter dispara onSubmit.
 */
import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { useEditor, EditorContent, ReactRenderer, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Markdown } from "tiptap-markdown";
import { Extension } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { cardAnexosStorage } from "@/lib/repositories/storage";
import { useInsertCardAnexo } from "@/hooks/quadros/useCards";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Image as ImageIcon,
  AtSign,
} from "lucide-react";
import { toast } from "sonner";

export type CommentProfile = { id: string; login: string | null; email: string | null };

export interface CommentEditorHandle {
  focus: () => void;
  clear: () => void;
}

interface Props {
  value: string;
  onChange: (md: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  profiles: CommentProfile[];
  cardId: string | null;
  ator: string;
  onAnexoCriado?: () => void;
  minHeight?: number;
}

// ---------- Mention (texto puro) ----------
function iniciais(s: string) {
  return s
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() ?? "")
    .join("");
}

type SuggestionState = {
  items: CommentProfile[];
  query: string;
  command: (item: { id: string }) => void;
  rect: { top: number; left: number } | null;
};

function MentionList({
  state,
  selected,
  onPick,
}: {
  state: SuggestionState;
  selected: number;
  onPick: (i: number) => void;
}) {
  if (!state.rect || state.items.length === 0) return null;
  return (
    <div
      className="fixed z-[60] w-64 max-h-56 overflow-auto rounded-md border bg-popover shadow-md text-sm"
      style={{ top: state.rect.top + 22, left: state.rect.left }}
    >
      {state.items.map((p, i) => (
        <button
          type="button"
          key={p.id}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(i);
          }}
          className={cn(
            "w-full text-left px-2 py-1.5 flex items-center gap-2 hover:bg-accent",
            i === selected && "bg-accent",
          )}
        >
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[9px]">{iniciais(p.login ?? "?")}</AvatarFallback>
          </Avatar>
          <span className="font-medium">@{p.login}</span>
          {p.email && <span className="text-muted-foreground text-xs truncate">{p.email}</span>}
        </button>
      ))}
    </div>
  );
}

function buildMentionExtension(getProfiles: () => CommentProfile[]) {
  return Extension.create({
    name: "mentionTexto",
    addOptions() {
      return {
        suggestion: {
          char: "@",
          allowSpaces: false,
          startOfLine: false,
          command: ({ editor, range, props }: any) => {
            // Insere `@login ` como texto puro — preserva extrairMencoes.
            editor.chain().focus().insertContentAt(range, `@${props.id} `).run();
          },
          items: ({ query }: { query: string }) => {
            const q = (query ?? "").toLowerCase();
            return getProfiles()
              .filter((p) => p.login && (q === "" || p.login.toLowerCase().includes(q)))
              .slice(0, 8)
              .map((p) => ({ id: p.login!, profile: p }));
          },
          render: () => {
            let cleanup: (() => void) | null = null;
            let onUpdateProps: ((p: any) => void) | null = null;
            return {
              onStart: (props: any) => {
                const handler = (window as any).__commentMentionHandler;
                if (!handler) return;
                const rect = props.clientRect?.();
                handler.show({
                  items: props.items.map((x: any) => x.profile),
                  query: props.query,
                  command: (it: { id: string }) => props.command({ id: it.id }),
                  rect: rect ? { top: rect.top, left: rect.left } : null,
                });
                onUpdateProps = (p: any) => {
                  const r = p.clientRect?.();
                  handler.update({
                    items: p.items.map((x: any) => x.profile),
                    query: p.query,
                    command: (it: { id: string }) => p.command({ id: it.id }),
                    rect: r ? { top: r.top, left: r.left } : null,
                  });
                };
                cleanup = () => handler.hide();
              },
              onUpdate: (props: any) => onUpdateProps?.(props),
              onKeyDown: (props: any) => {
                const handler = (window as any).__commentMentionHandler;
                if (!handler) return false;
                return handler.onKeyDown(props.event);
              },
              onExit: () => cleanup?.(),
            };
          },
        },
      };
    },
    addProseMirrorPlugins() {
      return [Suggestion({ editor: this.editor, ...this.options.suggestion })];
    },
  });
}

// ---------- Componente ----------
const CommentEditor = forwardRef<CommentEditorHandle, Props>(function CommentEditor(
  { value, onChange, onSubmit, placeholder, profiles, cardId, ator, onAnexoCriado, minHeight = 80 },
  ref,
) {
  const [suggestion, setSuggestion] = useState<SuggestionState | null>(null);
  const [selected, setSelected] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const insertCardAnexoMut = useInsertCardAnexo();
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;

  // Handler global compartilhado com a extensão Mention.
  useEffect(() => {
    (window as any).__commentMentionHandler = {
      show: (s: SuggestionState) => {
        setSuggestion(s);
        setSelected(0);
      },
      update: (s: SuggestionState) => {
        setSuggestion(s);
        setSelected((i) => Math.min(i, Math.max(0, s.items.length - 1)));
      },
      hide: () => setSuggestion(null),
      onKeyDown: (e: KeyboardEvent) => {
        if (!suggestionRef.current) return false;
        const s = suggestionRef.current;
        if (e.key === "ArrowDown") {
          setSelected((i) => (i + 1) % Math.max(1, s.items.length));
          return true;
        }
        if (e.key === "ArrowUp") {
          setSelected((i) => (i - 1 + s.items.length) % Math.max(1, s.items.length));
          return true;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          const item = s.items[selectedRef.current];
          if (item) s.command({ id: item.login! });
          return true;
        }
        if (e.key === "Escape") {
          setSuggestion(null);
          return true;
        }
        return false;
      },
    };
    return () => {
      delete (window as any).__commentMentionHandler;
    };
  }, []);
  const suggestionRef = useRef<SuggestionState | null>(null);
  suggestionRef.current = suggestion;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const mentionExt = useMemo(() => buildMentionExtension(() => profilesRef.current), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({
        placeholder: placeholder ?? "Comentário (markdown, @login, imagens)…",
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Markdown.configure({ html: false, breaks: true, linkify: true, transformPastedText: true }),
      mentionExt,
    ],
    content: value ?? "",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none px-3 py-2",
          "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
          "[&_img]:rounded-md [&_img]:my-2 [&_img]:max-h-64",
        ),
      },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          onSubmit?.();
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const items = Array.from(event.clipboardData?.items ?? []);
        const img = items.find((it) => it.type.startsWith("image/"));
        if (img) {
          const file = img.getAsFile();
          if (file) {
            event.preventDefault();
            void uploadAndInsert(file);
            return true;
          }
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const file = event.dataTransfer?.files?.[0];
        if (file && file.type.startsWith("image/")) {
          event.preventDefault();
          void uploadAndInsert(file);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = (ed.storage as any).markdown?.getMarkdown?.() ?? "";
      onChange(md);
    },
  });

  // Sync external value changes (ex.: clear após enviar).
  useEffect(() => {
    if (!editor) return;
    const current = (editor.storage as any).markdown?.getMarkdown?.() ?? "";
    if ((value ?? "") !== current) {
      editor.commands.setContent(value ?? "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus(),
      clear: () => editor?.commands.clearContent(),
    }),
    [editor],
  );

  async function uploadAndInsert(file: File) {
    if (!cardId) {
      toast.error("Salve o card antes de anexar imagens.");
      return;
    }
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${cardId}/${Date.now()}-${safe}`;
      const { error: upErr } = await cardAnexosStorage.upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: signed } = await cardAnexosStorage.createSignedUrl(
        path,
        60 * 60 * 24 * 365,
      );
      const url = signed?.signedUrl ?? "";
      await insertCardAnexoMut.mutateAsync({
        cardId,
        payload: {
          card_id: cardId,
          nome: file.name,
          storage_path: path,
          tamanho: file.size,
          mime: file.type || null,
          enviado_por: ator,
        },
      });
      editor?.chain().focus().setImage({ src: url, alt: file.name }).run();
      onAnexoCriado?.();
    } catch (err: any) {
      toast.error("Falha ao enviar imagem", { description: err.message });
    }
  }

  if (!editor) return <div className="rounded-md border bg-background" style={{ minHeight }} />;

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

  return (
    <div className="rounded-md border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring">
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1 bg-muted/30">
        <Button
          type="button"
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Negrito" title="Negrito"
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("italic") ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Itálico" title="Itálico"
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("strike") ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          aria-label="Tachado" title="Tachado"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("code") ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleCode().run()}
          aria-label="Código inline" title="Código inline"
        >
          <Code className="h-3.5 w-3.5" />
        </Button>
        <span className="mx-1 h-4 w-px bg-border" />
        <Button
          type="button"
          variant={editor.isActive("heading", { level: 2 }) ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Título 2" title="Título 2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("heading", { level: 3 }) ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          aria-label="Título 3" title="Título 3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </Button>
        <span className="mx-1 h-4 w-px bg-border" />
        <Button
          type="button"
          variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Lista" title="Lista"
        >
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Lista numerada" title="Lista numerada"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("blockquote") ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          aria-label="Citação" title="Citação"
        >
          <Quote className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("link") ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => e.preventDefault()}
          onClick={abrirLink}
          aria-label="Link" title="Link"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>
        <span className="mx-1 h-4 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Mencionar (@)" title="Mencionar (@)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().insertContent("@").run()}
        >
          <AtSign className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Inserir imagem" title="Inserir imagem"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadAndInsert(f);
            e.target.value = "";
          }}
        />
        <span className="ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Desfazer" title="Desfazer"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Refazer" title="Refazer"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground pl-1 pr-2">Ctrl+Enter envia</span>
        </span>
      </div>
      <div style={{ minHeight }} className="text-sm relative">
        <EditorContent editor={editor} />
      </div>
      {suggestion && (
        <MentionList
          state={suggestion}
          selected={selected}
          onPick={(i) => {
            const item = suggestion.items[i];
            if (item) suggestion.command({ id: item.login! });
          }}
        />
      )}
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
              <Button
                variant="outline"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  setLinkOpen(false);
                }}
              >
                Remover
              </Button>
            )}
            <Button onClick={aplicarLink}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default CommentEditor;
