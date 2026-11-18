import { AvatarUpload } from "@podrida/shared";
import DatabaseUserData, { AvatarFile } from "../../../types/userTypes/DatabaseUserData";

// What each accepted format starts with. The data URL's type has to match the bytes, so a file
// can't be served under a type it isn't.
const signatures: Record<string, (bytes: Buffer) => boolean> = {
  "image/png": (bytes) =>
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (bytes) => bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  "image/webp": (bytes) =>
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP",
};

const dataUrlPattern = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/]*={0,2})$/;

// Decodes a PNG, JPEG or WebP data URL. null when it's anything else, or not what it claims to be.
export const parseImageDataUrl = (dataUrl: string): AvatarFile | null => {
  const match = dataUrlPattern.exec(dataUrl);

  if (!match || match[2].length % 4 !== 0) {
    return null;
  }

  const [, contentType, base64] = match;
  const data = Buffer.from(base64, "base64");
  const hasSignature = signatures[contentType];

  return hasSignature?.(data) ? { contentType, data } : null;
};

export const toDataUrl = ({ contentType, data }: AvatarFile) =>
  `data:${contentType};base64,${data.toString("base64")}`;

type AvatarFields = Pick<DatabaseUserData, "avatar" | "avatarImage" | "avatarSource">;

// The user fields for a validated upload (see JoiAvatarUpload), to $set or create the user with.
export const getAvatarFields = (upload: AvatarUpload): AvatarFields => ({
  avatar: { crop: upload.crop, updatedAt: new Date() },
  // Already checked by the validator, a broken one never gets this far.
  avatarImage: parseImageDataUrl(upload.image) as AvatarFile,
  avatarSource: parseImageDataUrl(upload.source) as AvatarFile,
});

export const avatarFieldsToUnset = { avatar: "", avatarImage: "", avatarSource: "" } as const;

// Where anyone can get the user's avatar. The version changes with each new avatar, which lets
// the image be cached forever.
export const getAvatarUrl = (userId: string, avatar: DatabaseUserData["avatar"]) =>
  avatar?.updatedAt ? `/users/avatars/${userId}?v=${avatar.updatedAt.getTime()}` : undefined;
