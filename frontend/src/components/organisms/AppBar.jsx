// The top bar: the Oread mark and wordmark, the section tabs, the model badge, the colour-scheme
// toggle and, when accounts are on, who is signed in with a way to sign out.
import styled from "styled-components";
import { Row, Text, Pressable } from "../../ui/primitives/index.js";
import { Badge, Button, IconButton, OreadMark } from "../atoms/index.js";

const MARK_SIZE = 44;

// The toggle shows the current choice: light, dark, or following the system ("auto").
const COLOR_SCHEME_ICONS = { light: "sun", dark: "moon", auto: "auto" };

// The bar has no vertical padding of its own: the brand and the controls on the right carry it,
// and the tabs fill the full height, so the tab words sit on the same centre line as the logo
// while the current tab's underline lands on the bar's bottom edge.
const Bar = styled(Row)`
  align-items: stretch;
  gap: 36px;
  padding: 0 36px;
  padding-top: env(safe-area-inset-top);
  border-bottom: 1px solid ${({ theme }) => theme.colors.line};
  background: ${({ theme }) => theme.colors.header};
  flex-wrap: wrap;
`;

const BAR_VERTICAL_PADDING = "10px";

const Brand = styled(Row)`
  gap: 12px;
  padding: ${BAR_VERTICAL_PADDING} 0;
`;

const Wordmark = styled(Text)`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 32px;
  letter-spacing: -0.01em;
`;

const SectionTabs = styled(Row)`
  gap: 0;
  align-items: stretch;
`;

// A clear top border the same width as the underline keeps the word exactly centred; the -1px
// bottom margin lays the underline over the bar's own bottom border.
const SectionTab = styled(Pressable)`
  display: flex;
  align-items: center;
  font: inherit;
  font-weight: 600;
  font-size: 18px;
  color: ${({ $isCurrent, theme }) => ($isCurrent ? theme.colors.ink : theme.colors.muted)};
  padding: 0 18px;
  margin-bottom: -1px;
  background: transparent;
  border: 0;
  border-top: 3px solid transparent;
  border-bottom: 3px solid
    ${({ $isCurrent, theme }) => ($isCurrent ? theme.colors.accent : "transparent")};
  cursor: pointer;
  &:hover {
    color: ${({ theme }) => theme.colors.ink};
  }
`;

const RightSide = styled(Row)`
  margin-left: auto;
  gap: 14px;
  padding: ${BAR_VERTICAL_PADDING} 0;
`;

export function AppBar({
  views,
  currentView,
  badge,
  colorSchemePreference,
  onNavigate,
  onBadgePress,
  onCycleColorScheme,
  signedInAs,
  onSignOut,
}) {
  return (
    <Bar as="header">
      <Brand>
        <OreadMark size={MARK_SIZE} />
        <Wordmark>Oread</Wordmark>
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
        <Badge
          label={badge.label}
          isReady={badge.isReady}
          title={badge.title}
          onPress={onBadgePress}
        />
        <IconButton
          icon={COLOR_SCHEME_ICONS[colorSchemePreference] ?? "auto"}
          shape="round"
          iconSize={20}
          label={`Colour scheme: ${colorSchemePreference}. Change it`}
          onPress={onCycleColorScheme}
        />
        {onSignOut && (
          <Button label="Sign out" size="small" title={signedInAs} onPress={onSignOut} />
        )}
      </RightSide>
    </Bar>
  );
}
