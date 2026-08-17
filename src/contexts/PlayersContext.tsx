import React, { useCallback, useMemo, useRef } from "react";
import { createRequiredContext, useRequiredContext } from "@/contexts/createRequiredContext";
import type { Player } from "@/types";
import {
  useAddPlayer,
  useDeletePlayer,
  usePlayers,
  useUpdatePlayer,
} from "@/hooks/usePlayers";
import { useAuthState } from "@/contexts/auth/AuthContext";

/**
 * ARC-002.slice-31 + ARC-004.slice-08 · Onda 6 — Provider real de `players`
 * no paradigma único TanStack Query. Remove estado local paralelo e expõe CRUDs
 * como fachadas sobre mutations otimistas.
 */
export interface PlayersContextType {
  players: Player[];
  addPlayer: (p: Omit<Player, "id" | "isGM">) => void;
  updatePlayer: (id: string, d: Partial<Player>) => void;
  deletePlayer: (id: string) => void;
  playersLoaded: boolean;
}

const PlayersContext = createRequiredContext<PlayersContextType>({
  hook: "usePlayersContext",
  provider: "PlayersProvider",
  file: "src/contexts/PlayersContext.tsx",
});

export const PlayersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentPlayer, setCurrentPlayer } = useAuthState();
  const currentPlayerRef = useRef<Player | null>(currentPlayer);
  currentPlayerRef.current = currentPlayer;

  const onUpdateCurrent = useCallback(
    (id: string, d: Partial<Player>) =>
      setCurrentPlayer((prev) => (prev && prev.id === id ? { ...prev, ...d } : prev)),
    [setCurrentPlayer],
  );

  const queryEnabled =
    !!currentPlayer ||
    (typeof window !== "undefined" && !!localStorage.getItem("go_token"));

  const playersQuery = usePlayers({ enabled: queryEnabled });
  const addMutation = useAddPlayer();
  const updateMutation = useUpdatePlayer();
  const deleteMutation = useDeletePlayer();

  const players = playersQuery.data ?? [];

  const addPlayer = useCallback(
    (p: Omit<Player, "id" | "isGM">) => {
      addMutation.mutate(p);
    },
    [addMutation],
  );

  const updatePlayer = useCallback(
    (id: string, d: Partial<Player>) => {
      updateMutation.mutate({ id, data: d });
      onUpdateCurrent(id, d);
    },
    [onUpdateCurrent, updateMutation],
  );

  const deletePlayer = useCallback(
    (id: string) => {
      const current = currentPlayerRef.current;
      if (!current?.isGM) return;
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  const playersLoaded = !queryEnabled || playersQuery.isSuccess;

  const value = useMemo<PlayersContextType>(
    () => ({ players, addPlayer, updatePlayer, deletePlayer, playersLoaded }),
    [players, addPlayer, updatePlayer, deletePlayer, playersLoaded],
  );

  return <PlayersContext.Provider value={value}>{children}</PlayersContext.Provider>;
};

export const usePlayersContext = (): PlayersContextType => {
  return useRequiredContext(PlayersContext);
};
