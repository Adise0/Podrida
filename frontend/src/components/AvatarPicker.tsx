import type { AvatarCrop, AvatarSourceResponse, AvatarUpload } from "@podrida/shared";
import { useId, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import styled from "styled-components";
import { useRequest } from "../hooks/useRequest";
import {
  avatarSourceFromDataUrl,
  avatarSourceFromFile,
  avatarSourceFromUrl,
  buildAvatarUpload,
  defaultCrop,
  type AvatarSource,
} from "../lib/avatarImage";
import { Avatar } from "./Avatar";
import { AvatarEditor } from "./AvatarEditor";
import { ErrorAlert } from "./ErrorAlert";
import { Alert } from "./ui/Alert";
import { Button } from "./ui/Button";
import { MutedText } from "./ui/Card";
import { TextField } from "./ui/Field";
import { Row, Stack } from "./ui/layout";

const Layout = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space(5)};

  ${({ theme }) => theme.media.small} {
    align-items: flex-start;
    gap: ${({ theme }) => theme.space(4)};
  }
`;

// The picture doubles as the upload button and a drop target.
const DropTarget = styled.button<{ $isDragging: boolean }>`
  position: relative;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  cursor: pointer;

  &::after {
    content: "";
    position: absolute;
    inset: -4px;
    border: 2px dashed
      ${({ theme, $isDragging }) => ($isDragging ? theme.colors.accent : "transparent")};
    border-radius: 50%;
  }

  &:hover::after {
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }

  &:disabled {
    cursor: default;
  }
`;

const Title = styled.p`
  font-size: 14px;
  font-weight: 600;
`;

const UrlRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${({ theme }) => theme.space(2)};

  & > :first-child {
    flex: 1;
  }

  ${({ theme }) => theme.media.small} {
    flex-direction: column;
    align-items: stretch;
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

interface AvatarPickerProps {
  imageUrl?: string | null; // What's shown now: the saved avatar's path, or a picked one's data URL.
  name: string; // For the initials when there's no picture.
  // Called with the framed picture, or null to remove it. A rejection keeps the editor open
  // with the error.
  onChange: (upload: AvatarUpload | null) => Promise<void> | void;
  // The saved avatar's source, for re-framing an avatar this page didn't pick.
  loadSavedSource?: () => Promise<AvatarSourceResponse>;
  suggestion?: { url: string; label: string }; // Eg. the provider's picture on an OAuth sign-up.
  hint?: ReactNode;
  error?: string | null; // Eg. the API refused the picture sent along with a sign-up.
  disabled?: boolean;
}

interface Framing {
  source: AvatarSource;
  crop: AvatarCrop;
}

// Upload a file or paste a link, then frame it in a circle. Used on sign-up, on the OAuth sign-up
// and on the account page.
export function AvatarPicker({
  imageUrl,
  name,
  onChange,
  loadSavedSource,
  suggestion,
  hint,
  error,
  disabled = false,
}: AvatarPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [editing, setEditing] = useState<Framing | null>(null);
  // The last picture framed here, so "Adjust" doesn't have to fetch it again.
  const [lastFraming, setLastFraming] = useState<Framing | null>(null);
  const [isUrlOpen, setIsUrlOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const open = useRequest(async (load: () => Promise<Framing>) => {
    setEditing(await load());
  });

  const save = useRequest(async (framing: Framing) => {
    await onChange(buildAvatarUpload(framing.source, framing.crop));
    setLastFraming(framing);
    setEditing(null);
    setIsUrlOpen(false);
    setUrl("");
  });

  const remove = useRequest(async () => {
    await onChange(null);
    setLastFraming(null);
  });

  const isBusy = open.isPending || save.isPending || remove.isPending;
  const hasPicture = Boolean(imageUrl);
  const canAdjust = hasPicture && (lastFraming !== null || loadSavedSource !== undefined);

  const openNew = (load: () => Promise<AvatarSource>) => {
    save.reset();
    remove.reset();
    open.run(async () => ({ source: await load(), crop: defaultCrop }));
  };

  const openFile = (file: File | undefined) => {
    if (file) openNew(() => avatarSourceFromFile(file));
  };

  const adjust = () => {
    save.reset();
    open.run(async () => {
      if (lastFraming) return lastFraming;
      const saved = await loadSavedSource!();
      return { source: await avatarSourceFromDataUrl(saved.source), crop: saved.crop };
    });
  };

  // Not a <form>: the picker sits inside the sign-up forms, and forms can't be nested.
  const loadUrl = () => {
    const value = url.trim();
    if (value) openNew(() => avatarSourceFromUrl(value));
  };

  const onUrlKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault(); // Enter would submit the page's form otherwise.
    loadUrl();
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (!disabled && !isBusy) openFile(event.dataTransfer.files[0]);
  };

  return (
    <Stack $gap={3} role="group" aria-labelledby={titleId}>
      <Layout>
        <DropTarget
          type="button"
          $isDragging={isDragging}
          disabled={disabled || isBusy}
          aria-label="Upload a picture"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          <Avatar src={imageUrl} name={name} size={88} decorative />
        </DropTarget>

        <Stack $gap={2}>
          <Title id={titleId}>Profile picture</Title>
          <MutedText>
            {hint ?? "Shown in a circle next to your name. Drop an image here, or:"}
          </MutedText>
          <Row $gap={2}>
            <Button
              variant="secondary"
              small
              disabled={disabled || isBusy}
              loading={open.isPending && !isUrlOpen}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload
            </Button>
            <Button
              variant="secondary"
              small
              disabled={disabled || isBusy}
              onClick={() => setIsUrlOpen((current) => !current)}
              aria-expanded={isUrlOpen}
            >
              Use a link
            </Button>
            {canAdjust && (
              <Button variant="ghost" small disabled={disabled || isBusy} onClick={adjust}>
                Adjust
              </Button>
            )}
            {hasPicture && (
              <Button
                variant="ghost"
                small
                disabled={disabled || isBusy}
                loading={remove.isPending}
                onClick={() => remove.run()}
              >
                Remove
              </Button>
            )}
          </Row>
        </Stack>
      </Layout>

      {suggestion && !hasPicture && (
        <Row $gap={2}>
          <Avatar src={suggestion.url} name={name} size={32} decorative />
          <Button
            variant="ghost"
            small
            disabled={disabled || isBusy}
            onClick={() => openNew(() => avatarSourceFromUrl(suggestion.url))}
          >
            {suggestion.label}
          </Button>
        </Row>
      )}

      {isUrlOpen && (
        <UrlRow>
          <TextField
            label="Image link"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={url}
            disabled={disabled || isBusy}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={onUrlKeyDown}
          />
          <Button
            variant="secondary"
            disabled={disabled || isBusy || !url.trim()}
            loading={open.isPending}
            onClick={loadUrl}
          >
            Load
          </Button>
        </UrlRow>
      )}

      <ErrorAlert error={open.error ?? remove.error} />
      {error && !open.error && <Alert tone="error">{error}</Alert>}

      <HiddenInput
        ref={fileInputRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        onChange={(event) => {
          openFile(event.target.files?.[0]);
          event.target.value = ""; // So picking the same file again still opens it.
        }}
      />

      <AvatarEditor
        source={editing?.source ?? null}
        initialCrop={editing?.crop ?? defaultCrop}
        isPending={save.isPending}
        error={<ErrorAlert error={save.error} />}
        onCancel={() => {
          setEditing(null);
          save.reset();
        }}
        onConfirm={(crop) => editing && save.run({ source: editing.source, crop })}
      />
    </Stack>
  );
}
