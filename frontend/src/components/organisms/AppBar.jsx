// The top bar: brand, section tabs, the model badge and the colour-scheme toggle.
import styled from "styled-components";
import { Row, Text, Pressable } from "../../ui/primitives/index.js";
import { Badge, Button } from "../atoms/index.js";

const Bar = styled(Row)`
  gap: 16px;
  padding: 10px 16px;
  padding-top: max(10px, env(safe-area-inset-top));
  border-bottom: 1px solid ${({ theme }) => theme.colors.line};
  background: ${({ theme }) => theme.colors.panel};
  flex-wrap: wrap;
`;

const Brand = styled(Text)`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 24px;
  letter-spacing: -0.01em;
`;

const BrandMark = styled(Text)`
  color: ${({ theme }) => theme.colors.accent};
`;

const SectionTabs = styled(Row)`
  gap: 4px;
`;

const SectionTab = styled(Pressable)`
  font: inherit;
  font-weight: 600;
  font-size: 17px;
  color: ${({ theme }) => theme.colors.ink};
  padding: 7px 14px;
  border-radius: ${({ theme }) => theme.radii.small};
  cursor: pointer;
  border: 1px solid ${({ $isCurrent, theme }) => ($isCurrent ? theme.colors.line : "transparent")};
  background: ${({ $isCurrent, theme }) => ($isCurrent ? theme.colors.chip : "transparent")};
`;

const RightSide = styled(Row)`
  margin-left: auto;
  gap: 8px;
`;

export function AppBar({ views, currentView, badge, colorSchemePreference, onNavigate, onBadgePress, onCycleColorScheme }) {
  return (
    <Bar as="header">
      <Brand>
        <BrandMark aria-hidden="true">◐</BrandMark> Oread
      </Brand>
      <SectionTabs role="tablist" aria-label="Sections">
        {views.map((view) => (
          <SectionTab
            key={view.id}
            accessibilityRole="tab"
            isSelected={view.id === currentView}
            $isCurrent={view.id === currentView}
            onPress={() => onNavigate(view.id)}
          >
            {view.label}
          </SectionTab>
        ))}
      </SectionTabs>
      <RightSide>
        <Badge label={badge.label} isReady={badge.isReady} title={badge.title} onPress={onBadgePress} />
        <Button
          label="◑"
          variant="icon"
          accessibilityLabel="Toggle colour scheme"
          title={`Colour scheme: ${colorSchemePreference}`}
          onPress={onCycleColorScheme}
        />
      </RightSide>
    </Bar>
  );
}
