import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({ createClient: createClientMock }));

import {
  getPrimaryQuestionId,
  setPrimaryQuestionId,
  validatePrimaryQuestion,
} from "@/lib/survey-questions";

function makeQuery(result: { data: unknown; error: { message: string; code?: string } | null }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

describe("primary survey question", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts only an existing rating question from the requested survey", () => {
    expect(
      validatePrimaryQuestion({ id: "q1", survey_id: "s1", type: "rating" }, "s1"),
    ).toBeNull();
  });

  it.each([
    [null, "s1", "A pergunta selecionada não foi encontrada"],
    [{ id: "q1", survey_id: "s2", type: "rating" }, "s1", "pertencer a esta pesquisa"],
    [{ id: "q1", survey_id: "s1", type: "rating_10" }, "s1", "avaliação de 1 a 5"],
    [{ id: "q1", survey_id: "s1", type: "number" }, "s1", "avaliação de 1 a 5"],
    [{ id: "q1", survey_id: "s1", type: "short_text" }, "s1", "avaliação de 1 a 5"],
  ])("rejects an incompatible selection %#", (question, surveyId, expectedError) => {
    expect(validatePrimaryQuestion(question, surveyId)).toContain(expectedError);
  });

  it("loads an explicitly configured question", async () => {
    const surveyQuery = makeQuery({ data: { primary_question_id: "q1" }, error: null });
    createClientMock.mockReturnValue({ from: vi.fn(() => surveyQuery) });

    await expect(getPrimaryQuestionId("s1")).resolves.toEqual({
      primaryQuestionId: "q1",
      error: null,
    });
    expect(surveyQuery.select).toHaveBeenCalledWith("primary_question_id");
    expect(surveyQuery.eq).toHaveBeenCalledWith("id", "s1");
  });

  it("keeps an unconfigured survey distinct from a read error", async () => {
    const noConfiguration = makeQuery({ data: { primary_question_id: null }, error: null });
    createClientMock.mockReturnValue({ from: vi.fn(() => noConfiguration) });
    await expect(getPrimaryQuestionId("s1")).resolves.toEqual({
      primaryQuestionId: null,
      error: null,
    });

    const failedRead = makeQuery({ data: null, error: { message: "network unavailable" } });
    createClientMock.mockReturnValue({ from: vi.fn(() => failedRead) });
    await expect(getPrimaryQuestionId("s1")).resolves.toMatchObject({
      primaryQuestionId: null,
      error: expect.any(String),
    });
  });

  it("validates and saves only the configuration column", async () => {
    const questionQuery = makeQuery({
      data: { id: "q1", survey_id: "s1", type: "rating" },
      error: null,
    });
    const surveyQuery = makeQuery({ data: { primary_question_id: "q1" }, error: null });
    const from = vi.fn((table: string) => (table === "survey_questions" ? questionQuery : surveyQuery));
    createClientMock.mockReturnValue({ from });

    await expect(setPrimaryQuestionId("s1", "q1")).resolves.toEqual({
      primaryQuestionId: "q1",
      error: null,
    });
    expect(questionQuery.eq).toHaveBeenNthCalledWith(1, "id", "q1");
    expect(questionQuery.eq).toHaveBeenNthCalledWith(2, "survey_id", "s1");
    expect(surveyQuery.update).toHaveBeenCalledWith({ primary_question_id: "q1" });
    expect(surveyQuery.eq).toHaveBeenCalledWith("id", "s1");
  });

  it("rejects a different survey or a non-rating question before writing", async () => {
    const questionQuery = makeQuery({
      data: { id: "q1", survey_id: "s2", type: "rating_10" },
      error: null,
    });
    const surveyQuery = makeQuery({ data: { primary_question_id: "q1" }, error: null });
    const from = vi.fn((table: string) => (table === "survey_questions" ? questionQuery : surveyQuery));
    createClientMock.mockReturnValue({ from });

    await expect(setPrimaryQuestionId("s1", "q1")).resolves.toMatchObject({
      error: expect.stringContaining("pertencer a esta pesquisa"),
    });
    expect(surveyQuery.update).not.toHaveBeenCalled();
  });

  it("removes the configuration without changing other survey fields", async () => {
    const surveyQuery = makeQuery({ data: { primary_question_id: null }, error: null });
    const from = vi.fn(() => surveyQuery);
    createClientMock.mockReturnValue({ from });

    await expect(setPrimaryQuestionId("s1", null)).resolves.toEqual({
      primaryQuestionId: null,
      error: null,
    });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("surveys");
    expect(surveyQuery.update).toHaveBeenCalledWith({ primary_question_id: null });
  });

  it("does not report a failed write as a successful removal", async () => {
    const surveyQuery = makeQuery({ data: null, error: { message: "write failed" } });
    createClientMock.mockReturnValue({ from: vi.fn(() => surveyQuery) });

    await expect(setPrimaryQuestionId("s1", null)).resolves.toMatchObject({
      primaryQuestionId: null,
      error: expect.any(String),
    });
  });
});
