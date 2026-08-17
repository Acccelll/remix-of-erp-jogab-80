import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ROUTE_LABELS, KNOWN_ROUTES } from "@/config/navigation";
import { obraTabLabel } from "@/config/obra-tabs";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { obrasRepo } from "@/lib/repositories/obras";
import { boardsQueryFns } from "@/hooks/quadros/useBoards";
import { inspecaoModelosRepo, inspecaoQrAlvosRepo } from "@/lib/repositories/inspecoes";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isOpaqueId(seg: string): boolean {
  return UUID_RE.test(seg) || /^\d+$/.test(seg);
}

function shortId(seg: string): string {
  return `…${seg.slice(0, 6)}`;
}

function labelFor(seg: string): string {
  if (ROUTE_LABELS[seg]) return ROUTE_LABELS[seg];
  if (isOpaqueId(seg)) return shortId(seg);
  return decodeURIComponent(seg);
}

interface Crumb {
  label: string;
  to?: string;
  title?: string;
}

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { obras } = useCatalogos();

  const parts = pathname.split("/").filter(Boolean);

  // Resolvedores de rótulos dinâmicos -----------------------------------------
  const boardId =
    parts[0] === "quadros" && parts.length === 2 && parts[1] !== "meus" ? parts[1] : null;
  const cutoverObraId =
    parts[0] === "gm" && parts[1] === "cutover" && parts.length === 3 ? parts[2] : null;
  const modeloId =
    parts[0] === "inspecoes" &&
    parts.length === 2 &&
    !["dashboard", "agenda", "qr", "ncs", "lista"].includes(parts[1])
      ? parts[1]
      : null;
  const alvoId =
    parts[0] === "inspecoes" && parts[1] === "qr" && parts[2] === "go" && parts.length === 4
      ? parts[3]
      : null;

  const boardQ = useQuery({
    enabled: !!boardId,
    queryKey: ["breadcrumb-board", boardId],
    queryFn: async () => await boardsQueryFns.getBoardNome(boardId!),
    staleTime: 5 * 60_000,
  });
  const modeloQ = useQuery({
    enabled: !!modeloId,
    queryKey: ["breadcrumb-modelo", modeloId],
    queryFn: async () => await inspecaoModelosRepo.getNome(modeloId!),
    staleTime: 5 * 60_000,
  });
  const alvoQ = useQuery({
    enabled: !!alvoId,
    queryKey: ["breadcrumb-alvo", alvoId],
    queryFn: async () => await inspecaoQrAlvosRepo.getNome(alvoId!),
    staleTime: 5 * 60_000,
  });

  // Caso especial: /obras/:id → mostra nome da obra + aba ativa
  const isObraDetalhe = parts.length === 2 && parts[0] === "obras";
  const obraDetalheId = isObraDetalhe ? parts[1] : null;
  const obraFromContext = obraDetalheId
    ? obras.find((o) => String(o.id) === String(obraDetalheId))
    : undefined;
  const obraQ = useQuery({
    enabled: !!obraDetalheId && !obraFromContext?.nome,
    queryKey: ["breadcrumb-obra", obraDetalheId],
    queryFn: async () => {
      return await obrasRepo.getNome(obraDetalheId!);
    },
    staleTime: 5 * 60_000,
  });

  if (pathname === "/" || pathname === "") return null;

  const crumbs: Crumb[] = [];

  if (isObraDetalhe) {
    const id = parts[1];
    const nome = obraFromContext?.nome ?? obraQ.data ?? null;
    crumbs.push({ label: "Obras", to: "/obras" });
    crumbs.push({
      label: nome ?? `Obra ${shortId(id)}`,
      to: searchParams.get("tab") ? `/obras/${id}` : undefined,
    });
    const tabLabel = obraTabLabel(searchParams.get("tab"));
    if (tabLabel) crumbs.push({ label: tabLabel });
  } else {
    parts.forEach((seg, i) => {
      const to = "/" + parts.slice(0, i + 1).join("/");
      const isLast = i === parts.length - 1;
      let label = labelFor(seg);
      // Substituições dinâmicas conhecidas
      if (boardId && seg === boardId) label = boardQ.data ?? shortId(seg);
      else if (cutoverObraId && seg === cutoverObraId) {
        const o = obras.find((o) => String(o.id) === String(seg));
        label = o?.nome ?? shortId(seg);
      } else if (modeloId && seg === modeloId) label = modeloQ.data ?? shortId(seg);
      else if (alvoId && seg === alvoId) label = alvoQ.data ?? shortId(seg);

      const navegavel = KNOWN_ROUTES.has(to);
      crumbs.push({
        label,
        to: !isLast && navegavel ? to : undefined,
        title: label,
      });
    });
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/" title="Início">
              Início
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={`${c.label}-${i}`} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast || !c.to ? (
                  <BreadcrumbPage className="truncate max-w-[260px]" title={c.title ?? c.label}>
                    {c.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      to={c.to}
                      title={c.title ?? c.label}
                      className="truncate max-w-[260px] inline-block align-bottom"
                    >
                      {c.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
