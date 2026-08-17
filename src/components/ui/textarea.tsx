import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Faz a caixa acompanhar a altura do conteúdo, em vez de rolar por dentro.
   *
   * É opt-in de propósito: a altura fixa de `min-h-[80px]` continua sendo o
   * padrão, que é o que as outras dezenas de usos da base esperam. Ligue onde a
   * caixa já vive dentro de um container que rola — duas barras aninhadas é
   * justamente o que isto evita.
   *
   * Em Tailwind v4 isto seria a classe `field-sizing-content`; aqui ainda é v3,
   * então a medição é em JS.
   */
  autoResize?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoResize, onInput, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement>(null);
    // O ref de fora continua valendo: quem passa `ref` recebe o mesmo elemento
    // que medimos aqui.
    React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    const ajustarAltura = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      // Zerar antes de medir é o que permite encolher: com uma altura já
      // aplicada, `scrollHeight` nunca devolve menos do que ela.
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, []);

    // Efeito e não só `onInput`: o valor também chega de fora — abrir o
    // formulário de uma solicitação que já tem observação longa, por exemplo.
    React.useLayoutEffect(() => {
      if (autoResize) ajustarAltura();
    }, [autoResize, ajustarAltura, props.value]);

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          // A alça nativa de redimensionar brigaria com a altura calculada, e
          // `overflow-hidden` evita o piscar da barra entre o reset e a medida.
          autoResize && "resize-none overflow-hidden",
          className,
        )}
        ref={innerRef}
        onInput={(e) => {
          // Cobre o caso não-controlado, em que digitar não muda `props.value`.
          if (autoResize) ajustarAltura();
          onInput?.(e);
        }}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
