import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import styled, { css } from "styled-components";

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space(1.5)};
  min-width: 0;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const control = css<{ $invalid: boolean }>`
  width: 100%;
  min-height: 42px;
  padding: 0 ${({ theme }) => theme.space(3)};
  border: 1px solid
    ${({ theme, $invalid }) => ($invalid ? theme.colors.danger : theme.colors.borderStrong)};
  border-radius: ${({ theme }) => theme.radii.md};
  background: #fff;
  color: ${({ theme }) => theme.colors.text};
  font-size: 15px;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.focus};
    box-shadow: 0 0 0 3px rgba(47, 111, 176, 0.2);
  }

  &:disabled {
    background: ${({ theme }) => theme.colors.surfaceSunken};
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const Input = styled.input<{ $invalid: boolean }>`
  ${control}
`;

const Select = styled.select<{ $invalid: boolean }>`
  ${control}
  padding-right: ${({ theme }) => theme.space(8)};
`;

const Message = styled.p<{ $tone: "error" | "hint" | "success" }>`
  font-size: 13px;
  color: ${({ theme, $tone }) =>
    $tone === "error"
      ? theme.colors.danger
      : $tone === "success"
        ? theme.colors.success
        : theme.colors.textMuted};
`;

interface FieldMessages {
  label: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  success?: ReactNode; // Eg. "Available" next to a username.
}

function FieldMessage({ id, error, hint, success }: Omit<FieldMessages, "label"> & { id: string }) {
  if (error)
    return (
      <Message id={id} $tone="error">
        {error}
      </Message>
    );
  if (success)
    return (
      <Message id={id} $tone="success">
        {success}
      </Message>
    );
  if (hint)
    return (
      <Message id={id} $tone="hint">
        {hint}
      </Message>
    );
  return null;
}

type TextFieldProps = FieldMessages & InputHTMLAttributes<HTMLInputElement>;

export function TextField({ label, error, hint, success, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const hasMessage = Boolean(error || hint || success);

  return (
    <Wrapper>
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        $invalid={Boolean(error)}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasMessage ? messageId : undefined}
        {...props}
      />
      <FieldMessage id={messageId} error={error} hint={hint} success={success} />
    </Wrapper>
  );
}

type SelectFieldProps = FieldMessages & SelectHTMLAttributes<HTMLSelectElement>;

export function SelectField({ label, error, hint, id, children, ...props }: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const messageId = `${selectId}-message`;

  return (
    <Wrapper>
      <Label htmlFor={selectId}>{label}</Label>
      <Select
        id={selectId}
        $invalid={Boolean(error)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        {...props}
      >
        {children}
      </Select>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </Wrapper>
  );
}

const CheckboxLabel = styled.label`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space(2)};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;

  input {
    width: 16px;
    height: 16px;
    margin: 3px 0 0;
    accent-color: ${({ theme }) => theme.colors.accent};
  }
`;

type CheckboxProps = { label: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function Checkbox({ label, ...props }: CheckboxProps) {
  return (
    <CheckboxLabel>
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </CheckboxLabel>
  );
}
