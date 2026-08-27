/**
 * Hub GM — Usuários + Permissões em abas.
 */
import { lazy } from "react";
import { Building2, Lock, Users } from "lucide-react";
import HubTabs from "@/components/common/HubTabs";

const Usuarios = lazy(() => import("@/pages/gm/GM"));
const Permissoes = lazy(() => import("@/pages/gm/Permissoes"));
const MembrosObra = lazy(() => import("@/pages/gm/GMMembrosObra"));

export default function GMHub() {
  return (
    <HubTabs
      tabs={[
        { value: "usuarios", label: "Usuários", icon: Users, element: <Usuarios /> },
        { value: "permissoes", label: "Permissões", icon: Lock, element: <Permissoes /> },
        { value: "membros-obra", label: "Membros de Obra", icon: Building2, element: <MembrosObra /> },
      ]}
    />
  );
}
