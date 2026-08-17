import { Component, ErrorInfo, ReactNode } from "react";
import { logger } from "@/lib/core/logger";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 p-6 text-center">
        <h2 className="text-xl font-semibold">Algo deu errado</h2>
        <p className="text-sm text-muted-foreground max-w-md break-words">
          {error.message || "Erro inesperado ao renderizar esta área."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={this.reset}>
            Tentar novamente
          </Button>
          <Button onClick={() => window.location.reload()}>Recarregar página</Button>
        </div>
      </div>
    );
  }
}
