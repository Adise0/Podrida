import { ErrorCode, SocketCloseCode } from "@podrida/shared";
import jwt from "jsonwebtoken";
import { call, loginAs, staleSession, useApi } from "./helpers/api";
import { connectAs, expectError, expectOk, openSocket } from "./helpers/socket";

useApi();

describe("connecting", () => {
  test("only on the realtime path", async () => {
    await expect(openSocket({ path: "/elsewhere" })).rejects.toThrow("404");
  });

  test("refuses pages from other sites, takes the frontend and clients without an Origin", async () => {
    await expect(openSocket({ origin: "https://evil.example" })).rejects.toThrow("403");

    const fromFrontend = await openSocket({ origin: "http://front" });
    const withoutOrigin = await openSocket();

    await Promise.all([fromFrontend.close(), withoutOrigin.close()]);
  });
});

describe("session:auth", () => {
  test("is needed before anything else", async () => {
    const socket = await openSocket();
    const error = expectError(await socket.request("lobby:subscribe"));

    expect(error.code).toBe("MISSING_AUTH");
    await socket.close();
  });

  test("answers who it is and where they are", async () => {
    const { user, token } = await loginAs();
    const socket = await openSocket();

    expect(expectOk(await socket.request("session:auth", { token }))).toEqual({
      userId: user.id,
    });
    await socket.close();
  });

  test("an invalid token is refused and the connection closed", async () => {
    const socket = await openSocket();
    const error = expectError(await socket.request("session:auth", { token: "nope" }));

    expect(error.code).toBe("INVALID_TOKEN");
    expect((await socket.closed).code).toBe(SocketCloseCode.sessionEnded);
  });

  test("a new token for the same user keeps the connection, another user's closes it", async () => {
    const { user, token } = await loginAs();
    const other = await loginAs();
    const socket = await connectAs(token);

    expectOk(await socket.request("session:auth", { token: staleSession(user) }));
    expectOk(await socket.request("lobby:subscribe"));

    const error = expectError(await socket.request("session:auth", { token: other.token }));
    expect(error.code).toBe("FORBIDDEN");
    expect((await socket.closed).code).toBe(SocketCloseCode.sessionEnded);
  });

  test("the connection closes when its token expires", async () => {
    const { user } = await loginAs();
    const shortToken = jwt.sign(
      {
        purpose: "SESSION",
        id: user.id,
        tokenVersion: user.tokenVersion,
        sessionId: "short-session",
        authTime: Math.floor(Date.now() / 1000),
      },
      process.env.TOKEN_SECRET as string,
      { expiresIn: 1 },
    );
    const socket = await connectAs(shortToken);

    expect((await socket.closed).code).toBe(SocketCloseCode.sessionEnded);
  });

  test("revoking the sessions closes their connections", async () => {
    const { token } = await loginAs();
    const socket = await connectAs(token);

    expect((await call("POST", "/auth/signOutEverywhere", { token })).status).toBe(200);
    expect((await socket.closed).code).toBe(SocketCloseCode.sessionEnded);
  });

  test("a user can't keep more than 5 connections open", async () => {
    const { token } = await loginAs();
    const sockets = await Promise.all([1, 2, 3, 4, 5].map(() => connectAs(token)));
    const sixth = await openSocket();

    expect(expectError(await sixth.request("session:auth", { token })).code).toBe(
      "TOO_MANY_REQUESTS",
    );
    expect((await sixth.closed).code).toBe(SocketCloseCode.tooManyConnections);

    await Promise.all(sockets.map((socket) => socket.close()));
  });
});

describe("requests", () => {
  test("an unknown type is answered, not dropped", async () => {
    const { token } = await loginAs();
    const socket = await connectAs(token);

    expect(expectError(await socket.request("nope:nope" as "lobby:subscribe")).code).toBe(
      "UNKNOWN_REQUEST",
    );
    await socket.close();
  });

  test("payloads are validated like REST bodies", async () => {
    const { token } = await loginAs();
    const socket = await connectAs(token);
    const error = expectError(await socket.request("rooms:create", { name: "   " }));

    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.fields).toEqual({ name: "REQUIRED" });
    await socket.close();
  });

  test("anything that isn't a request closes the connection", async () => {
    const broken = await openSocket();
    broken.send("{not json");
    expect((await broken.closed).code).toBe(SocketCloseCode.protocolError);

    const noId = await openSocket();
    noId.send(JSON.stringify({ type: "lobby:subscribe" }));
    expect((await noId.closed).code).toBe(SocketCloseCode.protocolError);
  });

  test("a connection that floods is told to slow down", async () => {
    const { token } = await loginAs();
    const socket = await connectAs(token);
    const replies = await Promise.all(
      Array.from({ length: 30 }, () => socket.request("lobby:subscribe")),
    );
    const limited = replies.filter(
      (reply) => !reply.ok && reply.error.code === ErrorCode.TOO_MANY_REQUESTS,
    );

    expect(limited.length).toBeGreaterThan(0);
    await socket.close();
  });
});
