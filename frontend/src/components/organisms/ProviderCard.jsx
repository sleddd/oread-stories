// One provider's settings: credentials, model, other fields, "Use for chat" and a connection test.
import styled from "styled-components";
import { View, Row, Text } from "../../ui/primitives/index.js";
import { Heading2, RadioOption } from "../atoms/index.js";
import { ProviderFields } from "./ProviderFields.jsx";
import { ConnectionTest } from "./ConnectionTest.jsx";

const Card = styled(View)`
  background: ${({ theme }) => theme.colors.panel};
  border: 1px solid
    ${({ $isActive, theme }) => ($isActive ? theme.colors.accent : theme.colors.line)};
  box-shadow: ${({ $isActive, theme }) =>
    $isActive ? `0 0 0 1px ${theme.colors.accent}` : "none"};
  border-radius: ${({ theme }) => theme.radii.medium};
  padding: 14px 16px;
`;

const Header = styled(Row)`
  justify-content: space-between;
  gap: 10px;
`;

const Description = styled(Text)`
  display: block;
  color: ${({ theme }) => theme.colors.muted};
  font-size: 14.5px;
  margin: 2px 0 8px;
`;

export function ProviderCard({
  provider,
  settings,
  onUse,
  onSaveField,
  onFetchModels,
  onFetched,
  onTest,
}) {
  const isActive = settings.provider === provider.id;

  return (
    <Card as="section" $isActive={isActive}>
      <Header>
        <Heading2>{provider.name}</Heading2>
        <RadioOption
          label="Use for chat"
          isSelected={isActive}
          onSelect={() => onUse(provider.id)}
        />
      </Header>
      <Description>{provider.description}</Description>
      <ProviderFields
        provider={provider}
        settings={settings}
        onSaveField={onSaveField}
        onFetchModels={onFetchModels}
        onFetched={onFetched}
      />
      <ConnectionTest providerId={provider.id} onTest={onTest} />
    </Card>
  );
}
