import { afterEach, describe, expect, it } from "vitest";

import { getSupabaseEnv } from "@/lib/supabase/env";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

afterEach(() => {
  restoreEnv("NEXT_PUBLIC_SUPABASE_URL", originalUrl);
  restoreEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", originalAnonKey);
});

describe("getSupabaseEnv", () => {
  it("returns a valid HTTPS URL and configured anon key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.example.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    expect(getSupabaseEnv()).toEqual({
      supabaseUrl: "https://project.example.test",
      supabaseAnonKey: "test-anon-key",
    });
  });

  it("accepts an HTTP URL for a local Supabase instance", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "local-test-anon-key";

    expect(getSupabaseEnv()).toEqual({
      supabaseUrl: "http://127.0.0.1:54321",
      supabaseAnonKey: "local-test-anon-key",
    });
  });

  it.each([
    ["missing", undefined],
    ["malformed", "not a URL"],
    ["unsupported protocol", "ftp://project.example.test"],
  ])("rejects a %s Supabase URL", (_description, url) => {
    if (url === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    }
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    expect(() => getSupabaseEnv()).toThrow(
      "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP(S) URL.",
    );
  });

  it.each([["missing", undefined], ["empty", ""]])(
    "rejects a %s anon key",
    (_description, anonKey) => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.example.test";
      if (anonKey === undefined) {
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      } else {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;
      }

      expect(() => getSupabaseEnv()).toThrow(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to a valid anon key.",
      );
    },
  );

  it("rejects an anon key that is a URL without including it in the error", () => {
    const urlLikeKey = "https://key-value.example.test/private-test-value";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.example.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = urlLikeKey;

    try {
      getSupabaseEnv();
      throw new Error("Expected getSupabaseEnv to reject a URL used as the anon key.");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to a valid anon key.",
      );
      expect((error as Error).message).not.toContain(urlLikeKey);
      expect((error as Error).message).not.toContain("private-test-value");
    }
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
