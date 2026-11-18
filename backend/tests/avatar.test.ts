import { avatarLimits } from "@podrida/shared";
import Users from "../src/database/models/Users";
import { call, createUser, getMe, loginAs, register, useApi } from "./helpers/api";
import {
  installFakeOAuthProvider,
  oauthCode,
  resetFakeProvider,
} from "./helpers/fakeOAuthProvider";

useApi();

beforeAll(installFakeOAuthProvider);
beforeEach(resetFakeProvider);

// Only the signature is checked, not the picture itself, so a signature plus padding will do.
const pngBytes = (size = 64) =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(size),
  ]);

const webpBytes = (size = 64) =>
  Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(size)]);

const dataUrl = (type: string, bytes: Buffer) => `data:${type};base64,${bytes.toString("base64")}`;

const avatarUpload = (overrides: Record<string, unknown> = {}) => ({
  image: dataUrl("image/webp", webpBytes()),
  source: dataUrl("image/png", pngBytes(200)),
  crop: { x: 0.5, y: 0.4, zoom: 1.5 },
  ...overrides,
});

const putAvatar = (token: string, body: unknown) =>
  call("PUT", "/users/myUser/avatar", { token, body });

describe("own avatar", () => {
  test("can be set, shown to anyone, re-framed and removed", async () => {
    const { user, token } = await loginAs();

    expect((await getMe(token)).json.avatarUrl).toBeUndefined();

    const { status, json } = await putAvatar(token, avatarUpload());
    expect(status).toBe(200);
    expect(json.avatarUrl).toMatch(new RegExp(`^/users/avatars/${user.id}\\?v=\\d+$`));
    expect((await getMe(token)).json.avatarUrl).toBe(json.avatarUrl);

    // Public, cacheable for good under its versioned URL, and loadable from the frontend's origin.
    const image = await call("GET", json.avatarUrl);
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/webp");
    expect(image.headers.get("content-length")).toBe(String(webpBytes().length));
    expect(image.headers.get("cache-control")).toContain("immutable");
    expect(image.headers.get("cross-origin-resource-policy")).toBe("cross-origin");

    const source = await call("GET", "/users/myUser/avatar", { token });
    expect(source.json).toEqual({
      source: dataUrl("image/png", pngBytes(200)),
      crop: { x: 0.5, y: 0.4, zoom: 1.5 },
    });

    expect((await call("DELETE", "/users/myUser/avatar", { token })).status).toBe(200);
    expect((await getMe(token)).json.avatarUrl).toBeUndefined();
    expect((await call("GET", json.avatarUrl)).json.code).toBe("AVATAR_NOT_FOUND");
    expect((await call("GET", "/users/myUser/avatar", { token })).status).toBe(404);
  });

  test("a new avatar gets a new URL", async () => {
    const { token } = await loginAs();
    const first = await putAvatar(token, avatarUpload());
    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
    const second = await putAvatar(token, avatarUpload({ crop: { x: 0.2, y: 0.2, zoom: 2 } }));

    expect(second.json.avatarUrl).not.toBe(first.json.avatarUrl);
  });

  test("the files never leak through other answers", async () => {
    const { user, token } = await loginAs();
    await putAvatar(token, avatarUpload());

    const plain = await Users.findById(user.id);
    expect(plain?.avatar?.updatedAt).toBeInstanceOf(Date);
    expect(plain?.avatarImage).toBeUndefined();
    expect(plain?.avatarSource).toBeUndefined();
    expect((await getMe(token)).text).not.toContain("base64");
  });

  test("needs a session to change", async () => {
    expect((await putAvatar("", avatarUpload())).status).toBe(401);
    expect((await call("DELETE", "/users/myUser/avatar")).status).toBe(401);
  });

  test("only takes real PNG, JPEG or WebP data URLs", async () => {
    const { token } = await loginAs();
    const cases = [
      avatarUpload({ image: "https://example.com/me.png" }),
      avatarUpload({ image: dataUrl("image/svg+xml", Buffer.from("<svg/>")) }),
      // Claims to be a PNG but isn't one.
      avatarUpload({ image: dataUrl("image/png", Buffer.from("<html>hi</html>")) }),
      avatarUpload({ image: dataUrl("image/jpeg", pngBytes()) }),
      avatarUpload({ crop: { x: 2, y: 0.5, zoom: 1 } }),
      avatarUpload({ crop: { x: 0.5, y: 0.5, zoom: avatarLimits.maxZoom + 1 } }),
      avatarUpload({ source: undefined }),
    ];

    const statuses = await Promise.all(
      cases.map(async (body) => (await putAvatar(token, body)).status),
    );
    expect(statuses).toEqual(cases.map(() => 400));
  });

  test("refuses images over the limits", async () => {
    const { token } = await loginAs();
    const { status, json } = await putAvatar(
      token,
      avatarUpload({ image: dataUrl("image/png", pngBytes(avatarLimits.imageMaxBytes)) }),
    );

    expect(status).toBe(400);
    expect(json.fields).toEqual({ image: "TOO_LONG" });

    // A source at the limit still fits in the request.
    const bigSource = dataUrl("image/png", pngBytes(avatarLimits.sourceMaxBytes - 8));
    expect((await putAvatar(token, avatarUpload({ source: bigSource }))).status).toBe(200);
  });

  test("isn't shown for pending accounts, nor for unknown ids", async () => {
    const pending = await createUser({ activatedAt: undefined });
    await Users.updateOne(
      { _id: pending.id },
      {
        $set: {
          avatar: { crop: { x: 0.5, y: 0.5, zoom: 1 }, updatedAt: new Date() },
          avatarImage: { contentType: "image/png", data: pngBytes() },
        },
      },
    );

    expect((await call("GET", `/users/avatars/${pending.id}`)).status).toBe(404);
    expect((await call("GET", "/users/avatars/0123456789abcdef01234567")).status).toBe(404);
    expect((await call("GET", "/users/avatars/not-an-id")).status).toBe(400);
  });
});

describe("avatar on sign-up", () => {
  test("registration can come with one, shown once the account is active", async () => {
    expect((await register({ avatar: avatarUpload() })).status).toBe(201);

    const user = await Users.findOne().select("+avatarImage +avatarSource");
    expect(user?.avatarImage?.contentType).toBe("image/webp");
    expect(user?.avatarSource?.contentType).toBe("image/png");
    expect((await call("GET", `/users/avatars/${user?.id}`)).status).toBe(404);
  });

  test("a broken avatar fails the registration", async () => {
    const { status, json } = await register({ avatar: avatarUpload({ image: "nope" }) });

    expect(status).toBe(400);
    expect(json.fields).toEqual({ "avatar.image": "INVALID_FORMAT" });
    expect(await Users.countDocuments()).toBe(0);
  });

  test("a first OAuth sign-in offers the provider's picture and can set an avatar", async () => {
    const nonce = "nonce-nonce-nonce-nonce";
    const first = await call("POST", "/auth/oauth/google/login", {
      body: {
        code: oauthCode({
          nonce,
          sub: "g-1",
          email: "ann@gmail.com",
          picture: "https://lh3.googleusercontent.com/a/photo",
        }),
        nonce,
        codeVerifier: "v".repeat(43),
      },
    });

    expect(first.json.pictureUrl).toBe("https://lh3.googleusercontent.com/a/photo");

    const signup = await call("POST", "/auth/oauth/completeSignup", {
      body: { token: first.json.signupToken, username: "OAuth_User", avatar: avatarUpload() },
    });
    expect(signup.status).toBe(200);

    const { avatarUrl } = (await getMe(signup.json.token)).json;
    expect((await call("GET", avatarUrl)).status).toBe(200);
  });
});
