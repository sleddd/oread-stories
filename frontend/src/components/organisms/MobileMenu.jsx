// The phone menu's contents: the sections (current one highlighted), the model in use (pressing
// it opens Settings), the colour scheme, and Sign out when accounts are on.
import styled from "styled-components";
import { View, Row, Text, Pressable } from "../../ui/primitives/index.js";
import { Button, FieldLabel, Icon, IconButton } from "../atoms/index.js";
import { Tabs } from "../molecules/index.js";

const COLOR_SCHEME_CHOICES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "auto", label: "System" },
];

const Panel = styled(View)`
  gap: 14px;
  padding: 18px 14px 24px;
`;

// Runs edge to edge across the panel, so it cancels the panel's side padding.
const TitleRow = styled(Row)`
  justify-content: space-between;
  margin: 0 -14px;
  padding: 0 18px 14px 24px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.line};
`;

const Title = styled(Text)`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 24px;
`;

const Sections = styled(View)`
  gap: 4px;
`;

const SectionRow = styled(Pressable)`
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ $isCurrent, theme }) => ($isCurrent ? theme.colors.accentSoft : "transparent")};
  color: ${({ $isCurrent, theme }) => ($isCurrent ? theme.colors.accentStrong : theme.colors.ink)};
  font: inherit;
  font-weight: 600;
  font-size: 19px;
  text-align: left;
  cursor: pointer;
`;

const Divider = styled(View)`
  height: 1px;
  margin: 4px 6px;
  background: ${({ theme }) => theme.colors.line};
`;

const Group = styled(View)`
  gap: 8px;
  padding: 0 6px;
`;

const ModelCard = styled(Pressable)`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.segment};
  font: inherit;
  text-align: left;
  cursor: pointer;
`;

const StatusDot = styled(View)`
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 7px;
  border-radius: 50%;
  background: ${({ $isReady, theme }) => ($isReady ? theme.colors.positive : theme.colors.danger)};
`;

const ModelLines = styled(View)`
  gap: 2px;
  min-width: 0;
`;

const ProviderName = styled(Text)`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.ink};
`;

const ModelName = styled(Text)`
  color: ${({ theme }) => theme.colors.muted};
  overflow-wrap: anywhere;
`;

const FullWidthTabs = styled(Tabs)`
  align-self: stretch;
  & > * {
    flex: 1;
  }
`;

export function MobileMenu({
  views,
  currentView,
  model,
  colorSchemePreference,
  signedInAs,
  onNavigate,
  onOpenSettings,
  onChooseColorScheme,
  onSignOut,
  onClose,
}) {
  return (
    <Panel>
      <TitleRow>
        <Title>Menu</Title>
        <IconButton icon="close" label="Close menu" iconSize={22} onPress={onClose} />
      </TitleRow>
      <Sections role="tablist" aria-label="Sections">
        {views.map((view) => (
          <SectionRow
            key={view.id}
            $isCurrent={view.id === currentView}
            isSelected={view.id === currentView}
            accessibilityRole="tab"
            onPress={() => onNavigate(view.id)}
          >
            <Icon name={view.icon} size={22} />
            {view.label}
          </SectionRow>
        ))}
      </Sections>
      <Divider />
      <Group>
        <FieldLabel>Model</FieldLabel>
        <ModelCard
          accessibilityLabel={`Model: ${model.label}. Open Settings`}
          onPress={onOpenSettings}
        >
          <StatusDot $isReady={model.isReady} />
          <ModelLines>
            <ProviderName>{model.providerName}</ProviderName>
            <ModelName>{model.modelName}</ModelName>
          </ModelLines>
        </ModelCard>
      </Group>
      <Group>
        <FieldLabel>Theme</FieldLabel>
        <FullWidthTabs
          look="segmented"
          accessibilityLabel="Theme"
          tabs={COLOR_SCHEME_CHOICES}
          selectedId={colorSchemePreference}
          onSelect={onChooseColorScheme}
        />
      </Group>
      {onSignOut && (
        <Group>
          <Divider />
          {signedInAs && <ModelName>{signedInAs}</ModelName>}
          <Button label="Sign out" onPress={onSignOut} />
        </Group>
      )}
    </Panel>
  );
}
