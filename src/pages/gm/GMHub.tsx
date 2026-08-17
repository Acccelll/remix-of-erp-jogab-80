/**
 * Hub GM — Usuários + Permissões em abas.
 */
import { lazy } from "react";
import { Lock, Users } from "lucide-react";
import HubTabs from "@/components/common/HubTabs";

const Usuarios = lazy(() => import("@/pages/gm/GM"));
const Permissoes = lazy(() => import("@/pages/gm/Permissoes"));

export default function GMHub() {
  return (
    <HubTabs
      tabs={[
        { value: "usuarios", label: "Usuários", icon: Users, element: <Usuarios /> },
        { value: "permissoes", label: "Permissões", icon: Lock, element: <Permissoes /> },
      ]}
    />
  );
}
