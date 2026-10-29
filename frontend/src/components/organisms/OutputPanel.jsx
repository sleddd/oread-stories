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
  border-radius: 0 ${({ theme }) => theme.radii.medium} ${({ theme }) => theme.radii.medium};
  padding: 16px;
`;

const PromptText = styled(Text)`
  display: block;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 17px;
  line-height: 1.6;
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

const Actions = styled(Row)`
  margin-top: 12px;
`;

export function OutputPanel({ prompt, steering, onCopy }) {
  const [selectedTabId, setSelectedTabId] = useState("prompt");
  const steeringJson = JSON.stringify(steering, null, 2);
  const isPromptTab = selectedTabId === "prompt";

  return (
    <View>
      <Tabs tabs={OUTPUT_TABS} selectedId={selectedTabId} accessibilityLabel="Output" onSelect={setSelectedTabId} />
      <Pane>
        {isPromptTab && <PromptText data-testid="prompt-output">{prompt}</PromptText>}
        {!isPromptTab && <JsonText>{steeringJson}</JsonText>}
        <Actions>
          <Button label="Copy" onPress={() => onCopy(isPromptTab ? prompt : steeringJson)} />
        </Actions>
      </Pane>
    </View>
  );
}
