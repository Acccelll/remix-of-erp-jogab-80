import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  /** Classes do quadro (borda, cantos). Não use `overflow-hidden`: ver abaixo. */
  className?: string;
}

/**
 * Container de rolagem horizontal cuja barra fica grudada na base da tela
 * enquanto o conteúdo estiver à vista.
 *
 * O problema que ele resolve: a barra nativa mora no rodapé do elemento que
 * rola, então numa tabela alta ela nasce depois da última linha — para rolar de
 * lado é preciso primeiro descer a página inteira. Aqui a barra nativa é
 * escondida (`.scroll-x-hidden`) e no lugar dela vai uma barra espelho
 * `sticky bottom-0`, que acompanha o olho enquanto a tabela está na tela e
 * assenta no fim do quadro quando se passa dele.
 *
 * Cuidado ao usar: nada de `overflow-hidden` no `className`. Isso faria do
 * próprio quadro o contexto de rolagem da barra, e ela grudaria no rodapé do
 * quadro — de volta ao problema original.
 */
export function StickyScrollbar({ children, className }: Props) {
  const conteudoRef = useRef<HTMLDivElement>(null);
  const espelhoRef = useRef<HTMLDivElement>(null);
  // Mexer no scrollLeft de um dispara o evento `scroll` do outro; sem a trava,
  // os dois ficariam se empurrando.
  const sincronizando = useRef(false);
  const [larguraConteudo, setLarguraConteudo] = useState(0);
  const [transborda, setTransborda] = useState(false);

  useEffect(() => {
    const el = conteudoRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const medir = () => {
      setLarguraConteudo(el.scrollWidth);
      setTransborda(el.scrollWidth > el.clientWidth + 1);
    };
    medir();
    // Observa o container e o conteúdo: a largura muda tanto ao redimensionar a
    // janela quanto ao esconder colunas ou trocar a quantidade de itens.
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    if (el.firstElementChild) observador.observe(el.firstElementChild);
    return () => observador.disconnect();
  }, [children]);

  const espelhar = useCallback((de: HTMLDivElement | null, para: HTMLDivElement | null) => {
    if (!de || !para || sincronizando.current) return;
    sincronizando.current = true;
    para.scrollLeft = de.scrollLeft;
    requestAnimationFrame(() => {
      sincronizando.current = false;
    });
  }, []);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={conteudoRef}
        className="scroll-x-hidden"
        onScroll={() => espelhar(conteudoRef.current, espelhoRef.current)}
      >
        {children}
      </div>
      {transborda && (
        <div
          ref={espelhoRef}
          aria-hidden
          // Fundo opaco: com transparência, as linhas da tabela apareciam por
          // baixo da barra ao rolar a página.
          className="scroll-x-always sticky bottom-0 z-20 h-3 border-t border-border bg-background"
          onScroll={() => espelhar(espelhoRef.current, conteudoRef.current)}
        >
          <div className="h-px" style={{ width: larguraConteudo }} />
        </div>
      )}

    </div>
  );
}

export default StickyScrollbar;
