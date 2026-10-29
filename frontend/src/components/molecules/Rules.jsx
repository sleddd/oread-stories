// Situational rules: a builder ("when <situation>, shift <trait> toward <pole> <amount>") and a removable item.
import { useState } from "react";
import styled from "styled-components";
import { Row, Text } from "../../ui/primitives/index.js";
import { Button, SelectField } from "../atoms/index.js";

const RuleRow = styled(Row)`
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.line};
`;

const Connector = styled(Text)`
  color: ${({ theme }) => theme.colors.muted};
`;

const AMOUNT_LABELS = { slight: "slightly", strong: "strongly" };

function firstId(list) {
  return list[0]?.id ?? "";
}

export function RuleBuilder({ situations, axes, shifts, onAdd }) {
  const [situationId, setSituationId] = useState(firstId(situations));
  const [axisId, setAxisId] = useState(firstId(axes));
  const [direction, setDirection] = useState("high");
  const [amount, setAmount] = useState(firstId(shifts));

  const chosenAxis = axes.find((axis) => axis.id === axisId);
  const directionItems = [
    { value: "high", label: chosenAxis ? chosenAxis.high.toLowerCase() : "high pole" },
    { value: "low", label: chosenAxis ? chosenAxis.low.toLowerCase() : "low pole" },
  ];

  return (
    <RuleRow>
      <Connector>When</Connector>
      <SelectField
        accessibilityLabel="Situation"
        selectedValue={situationId}
        items={situations.map((situation) => ({ value: situation.id, label: situation.text }))}
        onValueChange={setSituationId}
      />
      <Connector>shift</Connector>
      <SelectField
        accessibilityLabel="Trait"
        selectedValue={axisId}
        items={axes.map((axis) => ({ value: axis.id, label: axis.name }))}
        onValueChange={setAxisId}
      />
      <Connector>toward</Connector>
      <SelectField accessibilityLabel="Direction" selectedValue={direction} items={directionItems} onValueChange={setDirection} />
      <SelectField
        accessibilityLabel="Amount"
        selectedValue={amount}
        items={shifts.map((shift) => ({ value: shift.id, label: AMOUNT_LABELS[shift.id] ?? shift.word }))}
        onValueChange={setAmount}
      />
      <Button
        label="Add rule"
        onPress={() => onAdd({ situation: situationId, axis: axisId, dir: direction, amount })}
      />
    </RuleRow>
  );
}

export function RuleItem({ description, onRemove }) {
  return (
    <RuleRow>
      <Connector>{description}</Connector>
      <Button label="Remove" size="small" onPress={onRemove} />
    </RuleRow>
  );
}
