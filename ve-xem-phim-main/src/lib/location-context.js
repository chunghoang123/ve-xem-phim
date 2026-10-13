import { createContext, useContext } from "react";

export const LocationContext = createContext(null);

export function useLocation() {
  return useContext(LocationContext);
}
