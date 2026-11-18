import { useState } from "react";
import styled from "styled-components";
import { API_URL } from "../api/client";
import { initialsOf } from "../lib/initials";

const Circle = styled.span<{ $size: number }>`
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.gold};
  color: ${({ theme }) => theme.colors.feltDeep};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ $size }) => Math.round($size * 0.4)}px;
  font-weight: 600;
  line-height: 1;
  user-select: none;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

// The API answers avatar paths ("/users/avatars/..."), a picture still being picked is a data URL.
const resolveAvatarSrc = (src?: string | null) =>
  src?.startsWith("/") ? `${API_URL}${src}` : (src ?? undefined);

interface AvatarProps {
  src?: string | null;
  name: string; // For the initials when there's no picture, and the alt text.
  size?: number;
  decorative?: boolean; // Next to the name already: screen readers can skip it.
}

// Always round. Falls back to the initials when there's no picture or it fails to load.
export function Avatar({ src, name, size = 40, decorative = false }: AvatarProps) {
  const resolved = resolveAvatarSrc(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = resolved && failedSrc !== resolved;

  return (
    <Circle
      $size={size}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
    >
      {showImage ? (
        <img src={resolved} alt="" draggable={false} onError={() => setFailedSrc(resolved)} />
      ) : (
        initialsOf(name)
      )}
    </Circle>
  );
}
