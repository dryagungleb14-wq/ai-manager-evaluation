import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface DropdownContextValue {
  openId: string | null;
  setOpenId: (id: string | null) => void;
}

const DropdownContext = createContext<DropdownContextValue | undefined>(undefined);

export function DropdownProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenIdState] = useState<string | null>(null);

  const setOpenId = useCallback((id: string | null) => {
    setOpenIdState(id);
  }, []);

  const value = useMemo(
    () => ({
      openId,
      setOpenId,
    }),
    [openId, setOpenId]
  );

  return <DropdownContext.Provider value={value}>{children}</DropdownContext.Provider>;
}

export function useDropdownController(id: string) {
  const context = useContext(DropdownContext);

  if (!context) {
    throw new Error("useDropdownController must be used within a DropdownProvider");
  }

  const { openId, setOpenId } = context;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setOpenId(open ? id : null);
    },
    [id, setOpenId]
  );

  const close = useCallback(() => {
    setOpenId(null);
  }, [setOpenId]);

  return {
    open: openId === id,
    onOpenChange: handleOpenChange,
    close,
  };
}
