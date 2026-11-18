import { avatarLimits } from "@podrida/shared";
import Joi from "joi";
import { nameMaxLength, usernameMaxLength, usernameMinLength } from "../serverConfig/server-config";
import { parseImageDataUrl } from "../../server/utils/users/avatar";

export const JoiObjectId = () => Joi.string().hex().length(24);

// bcrypt silently ignores everything past the first 72 bytes of a password, so anything longer
// is rejected up front instead of being truncated without the user knowing.
export const JoiPassword = () =>
  Joi.string().min(8).max(72, "utf8").messages({
    "string.min": "Password must have at least 8 characters",
    "string.max": "Password is too long",
  });

// Rejected rather than sanitized, so the username is always exactly what the user typed. The
// allowed characters also keep it from looking like an email, a URL or a phone number, since it
// ends up in email subjects.
export const JoiUsername = () =>
  Joi.string()
    .min(usernameMinLength)
    .max(usernameMaxLength)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .messages({
      "string.min": `Username must have at least ${usernameMinLength} characters`,
      "string.max": `Username can't have more than ${usernameMaxLength} characters`,
      "string.pattern.base": "Username can only have letters, numbers, _ and -",
    });

// Trimmed first, so a name made only of spaces counts as empty.
export const JoiName = () => Joi.string().trim().max(nameMaxLength);

// A PNG, JPEG or WebP data URL of at most maxBytes once decoded. The length check up front keeps a
// huge string from being decoded at all (base64 takes 4 characters for every 3 bytes).
const JoiImageDataUrl = (maxBytes: number) =>
  Joi.string()
    .max(Math.ceil(maxBytes / 3) * 4 + 32)
    .custom((value: string, helpers) => {
      const file = parseImageDataUrl(value);

      if (!file) {
        return helpers.error("image.invalid");
      }

      return file.data.length > maxBytes ? helpers.error("image.tooLarge") : value;
    })
    .messages({
      "string.max": "Image is too large",
      "image.invalid": "Image must be a PNG, JPEG or WebP data URL",
      "image.tooLarge": "Image is too large",
    });

// See AvatarUpload in @podrida/shared. The image is checked to be an image, not its dimensions:
// the browser is what renders it, and the size limit is what protects the server.
export const JoiAvatarUpload = () =>
  Joi.object({
    image: JoiImageDataUrl(avatarLimits.imageMaxBytes).required(),
    source: JoiImageDataUrl(avatarLimits.sourceMaxBytes).required(),
    crop: Joi.object({
      x: Joi.number().min(0).max(1).required(),
      y: Joi.number().min(0).max(1).required(),
      zoom: Joi.number().min(1).max(avatarLimits.maxZoom).required(),
    }).required(),
  });
