// "Test connection": asks the provider for a one-line reply and says how it went.
import { useState } from "react";
import styled from "styled-components";
import { Row } from "../../ui/primitives/index.js";
import { Button, StatusText } from "../atoms/index.js";

const Actions = styled(Row)`
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
`;

// onTest(providerId) resolves to { model, ms, reply }. onPassed() runs after a test succeeds.
export function ConnectionTest({ providerId, onTest, onPassed }) {
  const [status, setStatus] = useState({ text: "", isError: false });
  const [isTesting, setIsTesting] = useState(false);

  async function runTest() {
    setIsTesting(true);
    setStatus({ text: "Testing…", isError: false });
    try {
      const result = await onTest(providerId);
      const seconds = (result.ms / 1000).toFixed(1);
      const reply = (result.reply || "").slice(0, 40) || "(empty reply)";
      setStatus({
        text: `Connected to ${result.model} in ${seconds}s — “${reply}”`,
        isError: false,
      });
      onPassed?.();
    } catch (error) {
      setStatus({ text: error.message, isError: true });
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <Actions>
      <Button label="Test connection" disabled={isTesting} onPress={runTest} />
      <StatusText $isError={status.isError}>{status.text}</StatusText>
    </Actions>
  );
}
