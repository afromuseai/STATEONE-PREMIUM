import { describe, it, expect, vi } from "vitest";

// Test the pure functions that don't require database mocking
import { extractLearnings } from "./bi-memory";
import { getMostCommon } from "./services/bi-memory";

// Mock the database module to avoid DATABASE_URL requirement
vi.mock("@workspace/db", () => ({
  db: {},
  biMemoryTable: {},
  usersTable: {},
  projectsTable: {},
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
  ilike: vi.fn(),
  sql: vi.fn(),
  inArray: vi.fn(),
}));

describe("BI Memory Service - Pure Functions", () => {
  describe("extractLearnings", () => {
    it("should extract industry pattern and business model", () => {
      const mockOutput = {
        industry: "Healthcare",
        businessSnapshot: "AI scheduling for clinics with subscription model",
        strategicInsights: {
          growthBottleneck: "EMR integration complexity",
          fastestChannel: "Partnerships with EMR providers",
          highestLeverageAutomation: "Appointment reminders",
          operationalRisk: "HIPAA compliance",
        },
      } as any;

      const result = extractLearnings(mockOutput, "AI scheduling for healthcare");

      expect(result.industryPattern).toContain("Healthcare");
      expect(result.industryPattern).toContain("EMR integration");
      expect(result.businessModel).toContain("AI scheduling");
    });

    it("should handle missing fields gracefully", () => {
      const mockOutput = {} as any;

      const result = extractLearnings(mockOutput, "test idea");

      expect(result.industryPattern).toContain("general");
      expect(result.industryPattern).toContain("no bottleneck identified");
      expect(result.businessModel).toBe("Unknown");
    });
  });

  describe("getMostCommon", () => {
    it("should return most common items", () => {
      const items = ["a", "b", "a", "c", "a", "b"];
      const result = getMostCommon(items, 2);

      expect(result).toEqual(["a", "b"]);
    });

    it("should handle empty array", () => {
      const result = getMostCommon([], 3);
      expect(result).toEqual([]);
    });

    it("should limit results", () => {
      const items = ["a", "b", "c", "d", "e"];
      const result = getMostCommon(items, 3);

      expect(result.length).toBe(3);
    });
  });
});