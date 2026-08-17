import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Users, FileSearch, Clock, Package, Car, Building, Star } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { useObrasContext } from "@/contexts/ObrasContext";
import { usePatrimoniosContext } from "@/contexts/PatrimoniosContext";
import { useVeiculosContext } from "@/contexts/VeiculosContext";
import { useClientesContext } from "@/contexts/ClientesContext";
import { NAV_ITEMS } from "@/config/navigation";
import { rotaDaMatrizPara } from "@/lib/authz/paginas";
import { OBRA_TAB_ITEMS } from "@/config/obra-tabs";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import { swallow } from "@/lib/core/errors";

const RECENT_KEY = STORAGE_KEYS.navRecent;
const FAV_KEY = STORAGE_KEYS.navFavorites;

type Fav = { path: string; label: string };

function readFavorites(): Fav[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x): x is Fav => !!x && typeof (x as any).path === "string" && typeof (x as any).label === "string")
      .slice(0, 12);
  } catch {
    return [];
  }
}
function writeFavorites(list: Fav[]) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 12)));
  } catch (err) {
    swallow("cmd-palette.favoritos.save", err, "localStorage indisponível");
  }
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { obras } = useObrasContext();
  const { colaboradores } = useColaboradoresContext();
  const { patrimonios } = usePatrimoniosContext();
  const { veiculos } = useVeiculosContext();
  const { clientes } = useClientesContext();
  const { can, hasAccess, isGM } = usePermissions();
  // Gate fino por rota (mesmo critério da sidebar); /gm continua exclusivo de GM.
  // `NAV_ITEMS` inclui os HIDDEN_NAV_ITEMS, que NÃO têm linha na matriz: usar
  // `can(n.to)` direto devolvia false para todos eles e sumia com as abas de hub
  // (Fluxo de Caixa, Centros de Custo, Provisões, Contratos—Lista...) do ⌘K.
  // `rotaDaMatrizPara` encontra a linha que governa cada item.
  const navItems = NAV_ITEMS.filter((n) => {
    if (n.to.startsWith("/gm") && !isGM) return false;
    if (n.alwaysVisible === true) return true;
    const rota = rotaDaMatrizPara(n.to);
    return rota ? can(rota, "V") : hasAccess(n.permission, "visualizar");
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Recentes lidos ao abrir.
  const recents = useMemo<{ path: string; label: string }[]>(() => {
    if (!open) return [];
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
      return list
        .filter((p) => p !== location.pathname + location.search)
        .slice(0, 5)
        .map((path) => {
          // Resolve um rótulo amigável a partir do registro de navegação ou de uma obra.
          const navMatch = navItems.find((n) => path === n.to || path.startsWith(n.to + "?"));
          if (navMatch) return { path, label: navMatch.label };
          const obraMatch = path.match(/^\/obras\/([^/?]+)/);
          if (obraMatch) {
            const o = obras.find((x) => String(x.id) === obraMatch[1]);
            return { path, label: o ? `Obra: ${o.nome}` : path };
          }
          return { path, label: path };
        });
    } catch {
      return [];
    }
  }, [open, navItems, obras, location.pathname, location.search]);

  // Atalho para abas da obra atual.
  const obraMatch = location.pathname.match(/^\/obras\/([^/?]+)$/);
  const currentObraId = obraMatch?.[1];
  const currentObra = currentObraId ? obras.find((o) => String(o.id) === currentObraId) : null;

  const go = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 0);
  };

  // UX-009 — Favoritos globais persistidos em localStorage. Toggle inline
  // por item (Navegação e Obras), grupo dedicado no topo do palette.
  const [favorites, setFavorites] = useState<Fav[]>([]);
  useEffect(() => {
    if (open) setFavorites(readFavorites());
  }, [open]);
  const isFav = useCallback(
    (path: string) => favorites.some((f) => f.path === path),
    [favorites],
  );
  const toggleFav = useCallback((path: string, label: string) => {
    setFavorites((cur) => {
      const exists = cur.some((f) => f.path === path);
      const next = exists ? cur.filter((f) => f.path !== path) : [{ path, label }, ...cur];
      writeFavorites(next);
      return next;
    });
  }, []);

  function FavToggle({ path, label }: { path: string; label: string }) {
    const active = isFav(path);
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFav(path, label);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`ml-auto p-1 rounded hover:bg-accent ${active ? "text-warning" : "text-muted-foreground/60 hover:text-foreground"}`}
        aria-label={active ? `Remover ${label} dos favoritos` : `Favoritar ${label}`}
        title={active ? "Remover dos favoritos" : "Favoritar"}
      >
        <Star className={`h-3.5 w-3.5 ${active ? "fill-current" : ""}`} aria-hidden="true" />
      </button>
    );
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar obras, colaboradores, patrimônios, veículos, clientes… (Ctrl+K)" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        {favorites.length > 0 && (
          <>
            <CommandGroup heading="Favoritos">
              {favorites.map((f) => (
                <CommandItem
                  key={`fav-${f.path}`}
                  value={`favorito ${f.label} ${f.path}`}
                  onSelect={() => go(() => navigate(f.path))}
                >
                  <Star className="mr-2 h-4 w-4 fill-current text-warning" />
                  <span className="truncate">{f.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground truncate">{f.path}</span>
                  <FavToggle path={f.path} label={f.label} />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {recents.length > 0 && (
          <>
            <CommandGroup heading="Recentes">
              {recents.map((r) => (
                <CommandItem
                  key={`recent-${r.path}`}
                  value={`recente ${r.label} ${r.path}`}
                  onSelect={() => go(() => navigate(r.path))}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  <span className="truncate">{r.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground truncate">{r.path}</span>
                  <FavToggle path={r.path} label={r.label} />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {currentObra && (
          <>
            <CommandGroup heading={`Abas — ${currentObra.nome}`}>
              {OBRA_TAB_ITEMS.map((t) => (
                <CommandItem
                  key={`obra-tab-${t.value}`}
                  value={`aba ${t.label} ${currentObra.nome}`}
                  onSelect={() => go(() => navigate(`/obras/${currentObra.id}?tab=${t.value}`))}
                >
                  <t.icon className="mr-2 h-4 w-4" />
                  {t.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navegação">
          {navItems.map((n) => (
            <CommandItem
              key={n.to}
              value={`nav ${n.label} ${(n.keywords ?? []).join(" ")}`}
              onSelect={() => go(() => navigate(n.to))}
            >
              <n.icon className="mr-2 h-4 w-4" />
              {n.label}
              <FavToggle path={n.to} label={n.label} />
            </CommandItem>
          ))}
        </CommandGroup>

        {obras.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Obras">
              {obras.slice(0, 50).map((o) => (
                <CommandItem
                  key={o.id}
                  value={`obra ${o.nome} ${o.cliente ?? ""}`}
                  onSelect={() => go(() => navigate(`/obras/${o.id}`))}
                >
                  <FileSearch className="mr-2 h-4 w-4" />
                  <span className="font-medium truncate">{o.nome}</span>
                  {o.cliente && (
                    <span className="ml-2 text-xs text-muted-foreground truncate">
                      — {o.cliente}
                    </span>
                  )}
                  <FavToggle path={`/obras/${o.id}`} label={`Obra: ${o.nome}`} />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {colaboradores.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Colaboradores">
              {colaboradores.slice(0, 50).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`colab ${c.nome}`}
                  onSelect={() => go(() => navigate("/rh/colaboradores"))}
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span className="truncate">{c.nome}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {patrimonios.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Patrimônios">
              {patrimonios.slice(0, 50).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`patrimonio ${p.codigo} ${p.nome}`}
                  onSelect={() => go(() => navigate("/patrimonios/lista"))}
                >
                  <Package className="mr-2 h-4 w-4" />
                  <span className="font-medium truncate">{p.codigo}</span>
                  <span className="ml-2 text-xs text-muted-foreground truncate">— {p.nome}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {veiculos.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Veículos">
              {veiculos.slice(0, 50).map((v) => (
                <CommandItem
                  key={v.id}
                  value={`veiculo ${v.codigo} ${v.nome} ${v.tipo}`}
                  onSelect={() => go(() => navigate("/veiculos"))}
                >
                  <Car className="mr-2 h-4 w-4" />
                  <span className="font-medium truncate">{v.codigo}</span>
                  <span className="ml-2 text-xs text-muted-foreground truncate">
                    — {v.nome} · {v.tipo}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {clientes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Clientes">
              {clientes.slice(0, 50).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`cliente ${c.nome} ${c.nome_fantasia ?? ""} ${c.cnpj ?? ""}`}
                  onSelect={() => go(() => navigate("/crm/clientes"))}
                >
                  <Building className="mr-2 h-4 w-4" />
                  <span className="font-medium truncate">{c.nome}</span>
                  {c.nome_fantasia && (
                    <span className="ml-2 text-xs text-muted-foreground truncate">
                      — {c.nome_fantasia}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
