// Exactly what the next request will send: model, token estimate, system prompt and messages.
import styled from "styled-components";
import { View, Text, Row } from "../../ui/primitives/index.js";
import { Button, Heading3, Note, MonospaceBlock, EmptyState } from "../atoms/index.js";
import { StatGrid } from "../molecules/index.js";
import { CONTEXT_NOTE } from "../../content/copy.js";

const MessagePreview = styled(Text)`
  display: block;
  font-family: ${({ theme }) => theme.fonts.monospace};
  font-size: 12.5px;
  white-space: pre-wrap;
  max-height: 120px;
  overflow: auto;
  padding: 2px 8px;
  margin: 4px 0;
  border-left: 3px solid
    ${({ $role, theme }) => ($role === "user" ? theme.colors.accent : theme.colors.positive)};
`;

const RoleName = styled(Text)`
  font-family: ${({ theme }) => theme.fonts.interface};
  font-weight: 700;
`;

function describeLastReply(lastExchange) {
  const usage = lastExchange?.usage;
  if (!usage) {
    return null;
  }
  const stopNote = usage.stop ? `, stopped: ${usage.stop}` : "";
  return `Last reply (${lastExchange.model}): ${usage.input ?? "?"} tokens in, ${usage.output ?? "?"} out${stopNote}.`;
}

function contextStats(context) {
  return [
    { label: "Model", value: `${context.provider} · ${context.model || "not set"}` },
    { label: "Estimated tokens", value: `~${context.estimate.total.toLocaleString()}` },
    { label: "System prompt", value: `~${context.estimate.system.toLocaleString()} tokens` },
    { label: "Messages", value: context.messages.length },
  ];
}

export function ContextPanel({ context, lastExchange, onCopy }) {
  if (!context) {
    return <EmptyState>No chat open.</EmptyState>;
  }
  const lastReplyNote = describeLastReply(lastExchange);
  const requestJson = JSON.stringify(
    { system: context.system, messages: context.messages },
    null,
    2,
  );

  return (
    <View>
      <Heading3>Next request</Heading3>
      <Note>{CONTEXT_NOTE}</Note>
      <StatGrid stats={contextStats(context)} />
      {lastReplyNote && <Note>{lastReplyNote}</Note>}
      <Heading3>System prompt</Heading3>
      <MonospaceBlock>{context.system}</MonospaceBlock>
      <Heading3>Messages</Heading3>
      {context.messages.map((message, position) => (
        <MessagePreview key={position} $role={message.role}>
          <RoleName>{`${message.role}: `}</RoleName>
          {message.content}
        </MessagePreview>
      ))}
      <Row>
        <Button label="Copy as JSON" onPress={() => onCopy(requestJson)} />
      </Row>
    </View>
  );
}
