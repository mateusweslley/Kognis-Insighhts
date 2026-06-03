import { surveyStatuses } from "@/types/survey";

export function isValidSurveyStatus(status: string) {
  return surveyStatuses.includes(status as (typeof surveyStatuses)[number]);
}
