// A tabbed side panel. panes: { [tabId]: element }; only the selected pane is shown.
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";
import { Tabs } from "../molecules/index.js";

const StickyTabs = styled(Tabs)`
  padding: 10px 12px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.line};
  position: sticky;
  top: 0;
  background: ${({ theme }) => theme.colors.panel};
  z-index: 2;
`;

const Pane = styled(View)`
  padding: 12px 14px 30px;
`;

export function Inspector({ tabs, selectedTabId, onSelectTab, panes }) {
  return (
    <View>
      <StickyTabs tabs={tabs} selectedId={selectedTabId} accessibilityLabel="Inspector" onSelect={onSelectTab} />
      <Pane role="tabpanel">{panes[selectedTabId]}</Pane>
    </View>
  );
}
