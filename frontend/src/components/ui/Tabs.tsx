import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import styled from "styled-components";

// Tabs inside a card: the tab bar, and the panel of the selected tab. Arrow keys move between tabs
// (the WAI-ARIA tabs pattern), Tab moves on to the panel.

const TabList = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space(1)};
  align-self: flex-start;
  max-width: 100%;
  padding: ${({ theme }) => theme.space(1)};
  overflow-x: auto;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.surfaceSunken};
`;

const TabButton = styled.button<{ $isSelected: boolean }>`
  padding: ${({ theme }) => `${theme.space(1.5)} ${theme.space(4)}`};
  border: 0;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme, $isSelected }) => ($isSelected ? theme.colors.surface : "transparent")};
  box-shadow: ${({ $isSelected }) => ($isSelected ? "0 1px 3px rgba(0, 0, 0, 0.12)" : "none")};
  color: ${({ theme, $isSelected }) => ($isSelected ? theme.colors.text : theme.colors.textMuted)};
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

export interface TabItem<T extends string> {
  id: T;
  label: string;
  panel: ReactNode;
}

interface TabsProps<T extends string> {
  label: string; // For screen readers.
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Tabs<T extends string>({ label, tabs, value, onChange }: TabsProps<T>) {
  const baseId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = tabs.find((tab) => tab.id === value) ?? tabs[0];

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = (moves[event.key] + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    buttons.current[next]?.focus();
  };

  return (
    <>
      <TabList role="tablist" aria-label={label}>
        {tabs.map((tab, index) => {
          const isSelected = tab.id === selected.id;
          return (
            <TabButton
              key={tab.id}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel`}
              tabIndex={isSelected ? 0 : -1}
              $isSelected={isSelected}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </TabButton>
          );
        })}
      </TabList>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${selected.id}`}>
        {selected.panel}
      </div>
    </>
  );
}
