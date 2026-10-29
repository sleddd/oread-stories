// A tabbed side panel. panes: { [tabId]: element }; only the selected pane is shown.
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";
import { Tabs } from "../molecules/index.js";

const StickyBar = styled(View)`
  padding: 14px 18px 12px;
  position: sticky;
  top: 0;
  background: ${({ theme }) => theme.colors.panel};
  border-bottom: 1px solid ${({ theme }) => theme.colors.line};
  z-index: 2;
`;

const Pane = styled(View)`
  padding: 14px 18px 32px;
`;

export function Inspector({ tabs, selectedTabId, onSelectTab, panes }) {
  return (
    <View>
      <StickyBar>
        <Tabs
          look="segmented"
          tabs={tabs}
          selectedId={selectedTabId}
          accessibilityLabel="Inspector"
          onSelect={onSelectTab}
        />
      </StickyBar>
      <Pane role="tabpanel">{panes[selectedTabId]}</Pane>
    </View>
  );
}
