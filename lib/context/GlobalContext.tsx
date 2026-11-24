"use client";

import { createContext, useContext } from "react";
import type { HomeConfig, MeDTO } from "../types";

// ---------------------------------------------------------------------------
// Estado global: quién está conectado (y con qué rol) y la configuración
// del organismo. Lo carga el servidor una vez, en el layout de /tramites y
// de /gestion, y lo leen la cabecera y las pantallas que cambian según el
// rol, sin pedirlo cada una.
// ---------------------------------------------------------------------------

interface GlobalState {
  me: MeDTO;
  config: HomeConfig;
}

const GlobalContext = createContext<GlobalState | null>(null);

export function GlobalProvider({ value, children }: { value: GlobalState; children: React.ReactNode }) {
  return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>;
}

export function useGlobal(): GlobalState {
  const state = useContext(GlobalContext);
  if (!state) throw new Error("useGlobal fuera de <GlobalProvider>");
  return state;
}
