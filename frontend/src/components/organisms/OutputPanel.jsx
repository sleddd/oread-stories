// The generated system prompt and the steering JSON, each with a copy button.
import { useState } from "react";
import styled from "styled-components";
import { View, Row, Text } from "../../ui/primitives/index.js";
import { Button } from "../atoms/index.js";
import { Tabs } from "../molecules/index.js";

const OUTPUT_TABS = [
  { id: "prompt", label: "Prompt" },
  { id: "steering", label: "Steering JSON" },
];

const Pane = styled(View)`
  background: ${({ theme }) => theme.colors.panel};
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.medium};
  overflow: hidden;
`;

const PaneHeader = styled(Row)`
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 0 18px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.line};
  & [role="tablist"] {
    border-bottom: 0;
  }
`;

const PaneBody = styled(View)`
  padding: 18px 22px 22px;
`;

const PromptText = styled(Text)`
  display: block;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 17.5px;
  line-height: 1.65;
  white-space: pre-wrap;
  max-height: 70vh;
  overflow: auto;
`;

const JsonText = styled(Text)`
  display: block;
  font-family: ${({ theme }) => theme.fonts.monospace};
  font-size: 13px;
  line-height: 1.45;
  white-space: pre;
  max-height: 70vh;
  overflow: auto;
`;

export function OutputPanel({ prompt, steering, onCopy }) {
  const [selectedTabId, setSelectedTabId] = useState("prompt");
  const steeringJson = JSON.stringify(steering, null, 2);
  const isPromptTab = selectedTabId === "prompt";

  return (
    <Pane>
      <PaneHeader>
        <Tabs
          tabs={OUTPUT_TABS}
          selectedId={selectedTabId}
          accessibilityLabel="Output"
          onSelect={setSelectedTabId}
        />
        <Button
          label="Copy"
          size="small"
          onPress={() => onCopy(isPromptTab ? prompt : steeringJson)}
        />
      </PaneHeader>
      <PaneBody>
        {isPromptTab && <PromptText data-testid="prompt-output">{prompt}</PromptText>}
        {!isPromptTab && <JsonText>{steeringJson}</JsonText>}
      </PaneBody>
    </Pane>
  );
}
