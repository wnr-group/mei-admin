'use client';

import React, { createContext, useContext, useState } from 'react';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs components must be used within a <Tabs> provider');
  return ctx;
}

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function Tabs({ defaultValue, value, onValueChange, className, children }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value! : internalValue;

  const handleChange = (v: string) => {
    if (!controlled) setInternalValue(v);
    onValueChange?.(v);
  };

  return (
    <TabsContext.Provider value={{ value: current, onValueChange: handleChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      role="tablist"
      className={`flex border-b border-[#E8E0D5] bg-[#FAF8F5] ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const { value: current, onValueChange } = useTabs();
  const active = current === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onValueChange(value)}
      className={`px-5 py-3 text-[10px] font-bold tracking-widest uppercase transition-colors duration-150 border-b-2 -mb-px whitespace-nowrap ${
        active
          ? 'border-[#B38B5D] text-[#B38B5D]'
          : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
      } ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const { value: current } = useTabs();
  if (current !== value) return null;
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}
